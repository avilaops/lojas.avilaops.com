import type { Pedido, Tenant } from "@prisma/client";
import type { ItemCarrinho } from "@avilaops/checkout";
import { caixaDoCarrinho, pesoTotalKg } from "./frete";
import { prisma } from "./db";
import { emitir } from "./eventos";
import { conectado as melhorEnvioConectado } from "./melhor-envio-conta";
import { urlDaLoja } from "./tenant";

/**
 * Emissão de etiqueta pela CepCerto.
 *
 * A carteira é da Avila Ops: cada etiqueta tira dinheiro da NOSSA conta para
 * despachar o pedido de um lojista, que já recebeu o frete do comprador. Por
 * isso nada aqui emite sem antes gravar uma linha em `Postagem` — é o que a
 * plataforma tem a receber de volta. Emitir sem registrar seria financiar loja
 * sem saber quanto nem de quem.
 *
 * Contrato da API em https://cepcerto.com/integracao. Três detalhes que custam:
 *   - o `request_id` é a idempotência: repetir o mesmo não gera outro envio;
 *   - `valor_encomenda` (seguro) tem piso de R$ 50 e teto de R$ 35.000;
 *   - endereço não é enviado — a CepCerto resolve rua e bairro pelo CEP, e só
 *     o número e o complemento vêm de nós.
 */
const BASE = "https://cepcerto.com";

export class PostagemIndisponivel extends Error {}

function chave(): string {
  const t = process.env.CEPCERTO_POSTAGEM_KEY ?? process.env.CEP_CERTO_POSTAGEM_API_KEY ?? "";
  if (!t) throw new PostagemIndisponivel("Postagem não configurada (CEPCERTO_POSTAGEM_KEY).");
  return t;
}

async function chamar<T>(caminho: string, corpo: Record<string, unknown>): Promise<T> {
  const r = await fetch(BASE + caminho, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ token_cliente_postagem: chave(), ...corpo }),
    signal: AbortSignal.timeout(30_000),
  });
  const dados = (await r.json().catch(() => ({}))) as Record<string, unknown>;
  if (!r.ok || dados.status === "erro") {
    throw new Error(String(dados.mensagem ?? `CepCerto respondeu ${r.status}`));
  }
  return dados as T;
}

export interface SaldoPostagem {
  cliente: string;
  saldoCentavos: number;
}

export async function saldoDaCarteira(): Promise<SaldoPostagem> {
  const d = await chamar<{ nome_cliente?: string; saldo_atual?: string }>("/api-saldo/", {});
  const bruto = (d.saldo_atual ?? "0").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  return { cliente: d.nome_cliente ?? "-", saldoCentavos: Math.round((Number.parseFloat(bruto) || 0) * 100) };
}

/**
 * Descobre o serviço de postagem a partir do nome gravado no pedido.
 *
 * Devolve `null` quando não reconhece, e o chamador recusa a emissão. Rebaixar
 * em silêncio para PAC seria a pior saída possível: o comprador pagou o preço
 * de um serviço e a etiqueta sairia de outro, com a diferença saindo da nossa
 * carteira sem ninguém ver.
 */
function servicoDoPedido(freteNome: string): string | null {
  const n = freteNome.toLowerCase();
  if (n.includes("sedex")) return "sedex";
  if (n.includes("jadlog") && n.includes(".com")) return "jadlog-dotcom";
  if (n.includes("jadlog")) return "jadlog-package";
  if (n.includes("loggi")) return "loggi";
  if (n.includes("pac")) return "pac";
  return null;
}

interface RespostaEmissao {
  status?: string;
  sucesso?: boolean;
  mensagem?: string;
  frete?: {
    servico?: string;
    valor?: number;
    codigoObjeto?: string;
    pdfUrlEtiqueta?: string | null;
    pdfUrlDCE?: string | null;
    pdfPendente?: boolean;
  };
}

interface EnderecoEntrega {
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  cep: string;
}

export interface ResultadoEtiqueta {
  status: "emitida" | "pendente" | "erro";
  mensagem: string;
  codigoObjeto: string | null;
  pdfEtiqueta: string | null;
  custoCentavos: number;
}

/**
 * Emite a etiqueta de um pedido pago e guarda o que ela custou.
 *
 * Idempotente por pedido: se já existe uma postagem emitida, devolve a mesma em
 * vez de gastar de novo — o botão do painel é clicável mais de uma vez e o
 * lojista não pode pagar duas etiquetas por engano nosso.
 */
export async function emitirEtiqueta(
  t: Tenant,
  pedido: Pedido & { itens: Array<{ produtoId: string | null; nome: string; quantidade: number; precoUnitarioCentavos: number }> },
): Promise<ResultadoEtiqueta> {
  // O frete do pedido foi cotado pelo Melhor Envio, e esta emissão ainda é da
  // CepCerto. O pedido guarda só o nome do serviço ("PAC", "Jadlog .Package"),
  // que é igual nos dois: sem esta trava a etiqueta sairia por outro contrato,
  // a outro preço, e a diferença sairia da carteira sem ninguém ver.
  if (melhorEnvioConectado(t)) {
    throw new PostagemIndisponivel(
      "A etiqueta pelo Melhor Envio ainda não é gerada pelo painel. Compre a etiqueta na sua conta do Melhor Envio e cole o código de rastreio no pedido.",
    );
  }

  // Teto de adiantamento. A Avila Ops paga a etiqueta e recebe depois; sem um
  // limite, uma loja sozinha esvazia a carteira e as outras param de despachar.
  const emAberto = await postagemAAcertar(t.id);
  const teto = t.limitePostagemCentavos;
  if (teto > 0 && emAberto.custoCentavos >= teto) {
    throw new Error(
      `Esta loja já tem ${(emAberto.custoCentavos / 100).toFixed(2).replace(".", ",")} em postagem a acertar, no limite de ${(teto / 100).toFixed(2).replace(".", ",")}. Acerte antes de despachar mais.`,
    );
  }

  const jaTem = await prisma.postagem.findUnique({ where: { pedidoId: pedido.id } });
  if (jaTem && jaTem.status === "emitida") {
    return {
      status: "emitida",
      mensagem: "A etiqueta deste pedido já tinha sido gerada.",
      codigoObjeto: jaTem.codigoObjeto,
      pdfEtiqueta: jaTem.pdfEtiqueta,
      custoCentavos: jaTem.custoCentavos,
    };
  }

  const entrega = pedido.entrega as EnderecoEntrega | null;
  if (!entrega) throw new Error("Pedido de retirada na loja não gera etiqueta.");

  const servico = servicoDoPedido(pedido.freteNome);
  if (!servico) {
    throw new Error(
      `Não sei postar "${pedido.freteNome}" pela CepCerto. Despache manualmente e cole o código de rastreio no pedido.`,
    );
  }

  const origem = (t.cepOrigem ?? "").replace(/\D/g, "");
  if (origem.length !== 8) throw new Error("A loja precisa do CEP de origem para despachar (aba Entrega).");

  const enderecoLoja = (t.endereco as { numero?: string; complemento?: string } | null) ?? {};
  const seguro = Math.max(pedido.subtotalCentavos / 100, 50);

  // A caixa e o peso vêm dos produtos do pedido, pela mesma regra da cotação.
  // Despachar tudo com medida fixa é pedir para a transportadora recobrar a
  // diferença depois — e quem recebe essa conta é a carteira da Avila Ops.
  const produtos = await prisma.produto.findMany({
    where: { id: { in: pedido.itens.map((i) => i.produtoId).filter((v): v is string => Boolean(v)) } },
    select: { id: true, pesoKg: true, alturaCm: true, larguraCm: true, comprimentoCm: true },
  });
  const medidas = new Map(produtos.map((p) => [p.id, p]));
  const paraFrete: ItemCarrinho[] = pedido.itens.map((i) => {
    const m = i.produtoId ? medidas.get(i.produtoId) : undefined;
    return {
      id: i.produtoId ?? i.nome,
      nome: i.nome,
      quantidade: i.quantidade,
      precoUnitario: i.precoUnitarioCentavos,
      pesoGramas: m?.pesoKg != null ? Math.round(m.pesoKg * 1000) : undefined,
      alturaCm: m?.alturaCm ?? undefined,
      larguraCm: m?.larguraCm ?? undefined,
      comprimentoCm: m?.comprimentoCm ?? undefined,
    };
  });
  const caixa = caixaDoCarrinho(t, paraFrete);

  const resposta = await chamar<RespostaEmissao>("/api-postagem-frete/", {
    // Mesmo pedido, mesmo request_id: a CepCerto recusa a repetição em vez de
    // cobrar duas vezes se o botão for clicado de novo durante a chamada.
    request_id: `lojas-${pedido.referencia}`,
    tipo_entrega: servico,
    logistica_reversa: "N",
    cep_remetente: origem,
    cep_destinatario: entrega.cep.replace(/\D/g, ""),
    peso: String(pesoTotalKg(t, paraFrete)),
    altura: String(caixa.altura),
    largura: String(caixa.largura),
    comprimento: String(caixa.comprimento),
    valor_encomenda: seguro.toFixed(2),
    nome_remetente: t.razaoSocial ?? t.nome,
    cpf_cnpj_remetente: (t.cnpj ?? "").replace(/\D/g, ""),
    whatsapp_remetente: (t.whatsapp ?? "").replace(/\D/g, "").slice(-11),
    email_remetente: t.emailContato ?? t.loginEmail ?? "",
    numero_endereco_remetente: enderecoLoja.numero ?? "s/n",
    complemento_remetente: enderecoLoja.complemento ?? "",
    nome_destinatario: pedido.clienteNome,
    cpf_cnpj_destinatario: pedido.clienteDocumento.replace(/\D/g, ""),
    whatsapp_destinatario: pedido.clienteTelefone.replace(/\D/g, "").slice(-11),
    email_destinatario: pedido.clienteEmail,
    numero_endereco_destinatario: entrega.numero,
    complemento_destinatario: entrega.complemento ?? "",
    tipo_doc_fiscal: "declaracao",
    produtos: pedido.itens.map((i) => ({
      descricao: i.nome.slice(0, 60),
      valor: (i.precoUnitarioCentavos / 100).toFixed(2),
      quantidade: i.quantidade,
    })),
  });

  const frete = resposta.frete ?? {};
  const custoCentavos = Math.round((frete.valor ?? 0) * 100);
  const emitida = resposta.sucesso === true && Boolean(frete.codigoObjeto);

  const registro = await prisma.postagem.upsert({
    where: { pedidoId: pedido.id },
    create: {
      tenantId: t.id,
      pedidoId: pedido.id,
      servico: frete.servico ?? servico,
      codigoObjeto: frete.codigoObjeto || null,
      custoCentavos,
      cobradoDoCompradorCentavos: pedido.freteCentavos,
      pdfEtiqueta: frete.pdfUrlEtiqueta ?? null,
      pdfDeclaracao: frete.pdfUrlDCE ?? null,
      status: emitida ? "emitida" : "pendente",
      detalhe: resposta.mensagem ?? null,
    },
    update: {
      codigoObjeto: frete.codigoObjeto || null,
      custoCentavos,
      pdfEtiqueta: frete.pdfUrlEtiqueta ?? null,
      pdfDeclaracao: frete.pdfUrlDCE ?? null,
      status: emitida ? "emitida" : "pendente",
      detalhe: resposta.mensagem ?? null,
    },
  });

  // O rastreio no pedido é o que dispara o aviso ao comprador — só grava
  // quando a etiqueta saiu de verdade.
  if (emitida && frete.codigoObjeto) {
    await prisma.pedido.update({
      where: { id: pedido.id },
      data: { rastreio: frete.codigoObjeto, status: pedido.status === "PAGO" ? "EM_SEPARACAO" : pedido.status },
    });
  }

  return {
    status: emitida ? "emitida" : "pendente",
    mensagem:
      resposta.mensagem ??
      (emitida ? "Etiqueta gerada." : "A CepCerto aceitou o envio mas ainda não devolveu a etiqueta."),
    codigoObjeto: registro.codigoObjeto,
    pdfEtiqueta: registro.pdfEtiqueta,
    custoCentavos,
  };
}

/** Rastreamento pela CepCerto — só funciona para objeto postado por nós. */
export async function rastrear(codigoObjeto: string) {
  return chamar<Record<string, unknown>>("/api-rastreio/", { codigo_objeto: codigoObjeto });
}

/**
 * O que uma loja deve de postagem.
 *
 * A dívida é o **custo** da etiqueta, não a diferença para o que o comprador
 * pagou: quem decide se o frete é grátis, subsidiado ou cheio é o lojista, e
 * essa escolha é dele — a Avila Ops adiantou o valor cheio de qualquer forma.
 */
export async function postagemAAcertar(tenantId: string) {
  const r = await prisma.postagem.aggregate({
    where: { tenantId, status: "emitida", acertadaEm: null },
    _sum: { custoCentavos: true, cobradoDoCompradorCentavos: true },
    _count: { _all: true },
  });
  return {
    etiquetas: r._count._all,
    custoCentavos: r._sum.custoCentavos ?? 0,
    recebidoDoCompradorCentavos: r._sum.cobradoDoCompradorCentavos ?? 0,
  };
}

/** Avisa o comprador de que o pedido saiu, com transportadora e rastreio. */
export async function avisarEnvio(t: Tenant, pedido: Pedido, rastreio: string) {
  await emitir({
    tipo: "pedido.enviado",
    slug: t.slug,
    referencia: pedido.referencia,
    numero: pedido.numero,
    clienteNome: pedido.clienteNome,
    clienteEmail: pedido.clienteEmail,
    clienteTelefone: pedido.clienteTelefone,
    transportadora: pedido.freteNome,
    rastreio,
    linkPedido: `${urlDaLoja(t)}/pedido/${pedido.referencia}`,
    lojaNome: t.nome,
    lojaUrl: urlDaLoja(t),
    lojistaEmail: t.loginEmail ?? t.emailContato,
    lojistaWhatsapp: t.whatsapp,
    emailRemetente: t.emailRemetente,
  }, { chave: `enviado:${pedido.referencia}` });
}
