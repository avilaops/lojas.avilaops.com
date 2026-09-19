import { enderecoValido, type EmailParaEnviar } from "./email";

/**
 * O texto de cada e-mail que a plataforma manda.
 *
 * Vivia no n8n, em nós de e-mail que ninguém revisava e que ninguém conseguia
 * testar sem disparar de verdade. Aqui é função pura: entra o envelope do
 * evento, sai a mensagem — ou `null` quando aquele evento não manda e-mail
 * nenhum. Testável sem rede, sem banco e sem fluxo.
 *
 * Regras que valem para todos:
 *
 * - **Texto puro primeiro.** O HTML é conveniência; o texto é o que vai ser
 *   lido em cliente antigo, em leitor de tela e no preview do celular.
 * - **Nenhuma promessa que a loja não controla.** Nada de "chega amanhã".
 * - **Quem responde é o lojista**, não a plataforma: `Reply-To` do lojista em
 *   todo e-mail que vai ao comprador.
 * - **Remetente da loja quando existe.** `emailRemetente` só vem preenchido
 *   quando a plataforma provisionou `pedidos@<apex>`; sem ele, o endereço é o
 *   da plataforma e o nome que aparece é o da loja.
 */

/** O evento tem o tipo certo mas não os campos que ele promete: é defeito, não silêncio. */
export class DadosInsuficientes extends Error {}

type Envelope = Record<string, unknown>;

function texto(e: Envelope, campo: string): string | null {
  const v = e[campo];
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function exigir(e: Envelope, campo: string): string {
  const v = texto(e, campo);
  if (!v) throw new DadosInsuficientes(`campo obrigatório ausente: ${campo}`);
  return v;
}

function inteiro(e: Envelope, campo: string): number | null {
  const v = e[campo];
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

export const brl = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/** `&` num nome de produto não pode virar marcação na caixa de entrada de ninguém. */
export function escapar(valor: string): string {
  return valor
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * O mesmo envelope visual para todo e-mail: sem imagem, sem fonte externa,
 * sem coluna dupla. Cliente de e-mail não é navegador, e o que quebra layout
 * ali é justamente o que se faz por hábito na web.
 */
function pagina(titulo: string, corpo: string, rodape: string): string {
  return [
    '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    `<title>${escapar(titulo)}</title></head>`,
    '<body style="margin:0;padding:24px;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1d1d1f">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:14px;padding:28px">',
    `<tr><td><h1 style="margin:0 0 16px;font-size:20px;line-height:1.3">${escapar(titulo)}</h1>`,
    corpo,
    `<p style="margin:24px 0 0;font-size:13px;color:#6e6e73">${rodape}</p>`,
    "</td></tr></table></body></html>",
  ].join("");
}

const p = (t: string) => `<p style="margin:0 0 12px;font-size:15px;line-height:1.5">${t}</p>`;
const botao = (url: string, rotulo: string) =>
  `<p style="margin:20px 0"><a href="${escapar(url)}" style="display:inline-block;background:#1d1d1f;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-size:15px">${escapar(rotulo)}</a></p>`;

/** Só http(s): `javascript:` num link de e-mail é o clássico. */
function linkSeguro(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

interface Remetente {
  de: string | null;
  nomeDe: string | null;
  responderPara: string | null;
}

/** De quem o comprador vê que veio, e para quem a resposta dele vai. */
function daLoja(e: Envelope): Remetente {
  const remetente = texto(e, "emailRemetente");
  return {
    de: remetente && enderecoValido(remetente) ? remetente : null,
    nomeDe: texto(e, "lojaNome") ?? texto(e, "nome"),
    responderPara: texto(e, "lojistaEmail") ?? texto(e, "emailContato"),
  };
}

export type EmailDoEvento = EmailParaEnviar;

/**
 * Os tipos de evento cujo efeito inteiro é um e-mail — e por isso podem sair
 * do n8n sem perder nada pelo caminho.
 *
 * Os que também mandam WhatsApp (`pedido.pago`, `carrinho.abandonado`,
 * `pedido.criado`, `pedido.recusado`, `loja.criada`, `loja.provisionada`)
 * ficam de fora **de propósito**: trazer só a metade de e-mail para cá faria
 * o aviso do lojista sumir sem ninguém notar.
 */
export const TIPOS_COM_EMAIL_PROPRIO = [
  "lojista.recuperar-senha",
  "loja.voltou-ao-estoque",
  "pedido.em-separacao",
  "pedido.enviado",
  "pedido.entregue",
  "pedido.cancelado",
  "loja.relatorio-semanal",
  // Não mandam e-mail nenhum: o fluxo só encerrava o ciclo. Entram aqui para
  // sair da fila em casa, sem viagem ao n8n.
  "categoria.seo-pendente",
  "categoria.seo-publicado",
] as const;

export type TipoComEmailProprio = (typeof TIPOS_COM_EMAIL_PROPRIO)[number];

/**
 * A mensagem que este evento manda, ou `null` quando não manda nenhuma.
 *
 * `null` é resposta legítima em dois casos: evento que não notifica ninguém
 * (SEO de categoria) e evento cujo destinatário não existe — loja sem e-mail
 * de contato, comprador do Mercado Livre, que não tem e-mail do lado de cá.
 */
export function emailDoEvento(envelope: Envelope): EmailDoEvento | null {
  switch (texto(envelope, "tipo")) {
    case "lojista.recuperar-senha":
      return recuperarSenha(envelope);
    case "loja.voltou-ao-estoque":
      return voltouAoEstoque(envelope);
    case "pedido.em-separacao":
      return pedidoEmSeparacao(envelope);
    case "pedido.enviado":
      return pedidoEnviado(envelope);
    case "pedido.entregue":
      return pedidoEntregue(envelope);
    case "pedido.cancelado":
      return pedidoCancelado(envelope);
    case "pedido.pago":
      return pedidoPago(envelope);
    case "pedido.recusado":
      return pedidoRecusado(envelope);
    case "carrinho.abandonado":
      return carrinhoAbandonado(envelope);
    case "loja.criada":
      return lojaCriada(envelope);
    case "loja.provisionada":
      return lojaProvisionada(envelope);
    case "pedido.pix-pendente":
      return pixPendente(envelope);
    case "loja.indicacoes":
      return indicacoes(envelope);
    case "loja.relatorio-semanal":
      return relatorioSemanal(envelope);
    default:
      // Inclui os de SEO de categoria, que não notificam ninguém.
      return null;
  }
}

/** `/pedido/<referencia>` é a página pública do pedido: a referência é o segredo. */
function linkDoPedido(e: Envelope): string | null {
  const direto = linkSeguro(texto(e, "linkPedido"));
  if (direto) return direto;
  const base = texto(e, "lojaUrl");
  const referencia = texto(e, "referencia");
  return base && referencia ? linkSeguro(`${base.replace(/\/+$/, "")}/pedido/${encodeURIComponent(referencia)}`) : null;
}

function listaDeItens(e: Envelope): string[] {
  const itens = e.itens;
  if (!Array.isArray(itens)) return [];
  return itens
    .filter((i): i is { nome: string; quantidade: number } => Boolean(i) && typeof i === "object")
    .map((i) => `${i.quantidade}x ${i.nome}`);
}

function pedidoPago(e: Envelope): EmailDoEvento | null {
  const para = texto(e, "clienteEmail");
  // Pedido de canal externo não tem e-mail do comprador: a conversa é lá.
  if (!enderecoValido(para)) return null;
  const loja = exigir(e, "lojaNome");
  const numero = String(inteiro(e, "numero") ?? exigir(e, "referencia"));
  const total = inteiro(e, "totalCentavos") ?? 0;
  const link = linkDoPedido(e);
  const itens = listaDeItens(e);
  const linhas = [
    texto(e, "clienteNome") ? `Olá, ${texto(e, "clienteNome")}!` : "Olá!",
    ``,
    `Seu pagamento foi confirmado na ${loja}.`,
    ``,
    ...(itens.length ? [...itens, ``] : []),
    `Total: ${brl(total)}`,
  ];
  if (link) linhas.push(``, `Acompanhe pelo pedido: ${link}`);
  return {
    para,
    assunto: `Pedido ${numero} confirmado — ${loja}`,
    texto: linhas.join("\n"),
    html: pagina(
      "Pagamento confirmado",
      p(`Seu pagamento foi confirmado na <b>${escapar(loja)}</b>.`) +
        (itens.length ? `<ul style="margin:0 0 12px;padding-left:20px;font-size:15px;line-height:1.6">${itens.map((i) => `<li>${escapar(i)}</li>`).join("")}</ul>` : "") +
        p(`Total: <b>${brl(total)}</b>`) +
        (link ? botao(link, "Acompanhar o pedido") : ""),
      `Pedido ${escapar(numero)} · ${escapar(loja)}`,
    ),
    ...daLoja(e),
  };
}

function pedidoRecusado(e: Envelope): EmailDoEvento | null {
  const para = texto(e, "clienteEmail");
  if (!enderecoValido(para)) return null;
  const loja = exigir(e, "lojaNome");
  const url = linkSeguro(texto(e, "lojaUrl"));
  const motivo = texto(e, "motivo");
  const linhas = [
    texto(e, "clienteNome") ? `Olá, ${texto(e, "clienteNome")}!` : "Olá!",
    ``,
    `O pagamento do seu pedido na ${loja} não foi aprovado.`,
  ];
  if (motivo) linhas.push(`Motivo informado: ${motivo}.`);
  linhas.push(`Você pode tentar de novo, inclusive com Pix, que é aprovado na hora.`);
  if (url) linhas.push(``, url);
  return {
    para,
    assunto: `Pagamento não aprovado — ${loja}`,
    texto: linhas.join("\n"),
    html: pagina(
      "Pagamento não aprovado",
      p(`O pagamento do seu pedido na <b>${escapar(loja)}</b> não foi aprovado.`) +
        (motivo ? p(`Motivo informado: ${escapar(motivo)}.`) : "") +
        p("Você pode tentar de novo, inclusive com Pix, que é aprovado na hora.") +
        (url ? botao(url, "Tentar de novo") : ""),
      "Se precisar de ajuda, responda este e-mail.",
    ),
    ...daLoja(e),
  };
}

function carrinhoAbandonado(e: Envelope): EmailDoEvento | null {
  const para = texto(e, "clienteEmail");
  if (!enderecoValido(para)) return null;
  const loja = exigir(e, "lojaNome");
  const link = linkSeguro(texto(e, "linkCarrinho"));
  const total = inteiro(e, "totalCentavos");
  const itens = listaDeItens(e);
  const linhas = [
    texto(e, "clienteNome") ? `Olá, ${texto(e, "clienteNome")}!` : "Olá!",
    ``,
    `Seu carrinho na ${loja} continua guardado.`,
    ``,
    ...(itens.length ? [...itens, ``] : []),
  ];
  if (total !== null && total > 0) linhas.push(`Total: ${brl(total)}`);
  if (link) linhas.push(``, link);
  return {
    para,
    assunto: `Seu carrinho na ${loja} continua guardado`,
    texto: linhas.join("\n"),
    html: pagina(
      "Seu carrinho continua guardado",
      p(`Na <b>${escapar(loja)}</b>.`) +
        (itens.length ? `<ul style="margin:0 0 12px;padding-left:20px;font-size:15px;line-height:1.6">${itens.map((i) => `<li>${escapar(i)}</li>`).join("")}</ul>` : "") +
        (total !== null && total > 0 ? p(`Total: <b>${brl(total)}</b>`) : "") +
        (link ? botao(link, "Finalizar a compra") : ""),
      "Se não quiser mais, é só ignorar: nada foi cobrado.",
    ),
    ...daLoja(e),
  };
}

/** Os dois avisos ao lojista quando a loja nasce e quando fica configurada. */
function lojaParaOLojista(
  e: Envelope,
  opcoes: { assunto: (loja: string) => string; titulo: string; frase: string; rodape: string },
): EmailDoEvento | null {
  const para = texto(e, "emailContato");
  if (!enderecoValido(para)) return null;
  const loja = exigir(e, "nome");
  const url = linkSeguro(texto(e, "url"));
  const linhas = [`Olá!`, ``, opcoes.frase.replace("{loja}", loja)];
  if (url) linhas.push(``, url);
  return {
    para,
    assunto: opcoes.assunto(loja),
    texto: linhas.join("\n"),
    html: pagina(
      opcoes.titulo,
      p(opcoes.frase.replace("{loja}", `<b>${escapar(loja)}</b>`)) + (url ? botao(url, "Abrir a loja") : ""),
      opcoes.rodape,
    ),
  };
}

function lojaCriada(e: Envelope) {
  return lojaParaOLojista(e, {
    assunto: (loja) => `${loja} está no ar para você aprovar`,
    titulo: "Sua loja está no ar",
    frase: "A loja {loja} já está no ar para você conferir e aprovar.",
    rodape: "Cadastre produtos e ajuste as cores no painel da plataforma.",
  });
}

function lojaProvisionada(e: Envelope) {
  return lojaParaOLojista(e, {
    assunto: (loja) => `${loja}: domínio e e-mail configurados`,
    titulo: "Domínio e e-mail configurados",
    frase: "O domínio, o DNS e o e-mail da loja {loja} estão configurados. Ela já pode receber pedidos.",
    rodape: "Qualquer coisa, responda este e-mail.",
  });
}

function recuperarSenha(e: Envelope): EmailDoEvento | null {
  const para = exigir(e, "email");
  if (!enderecoValido(para)) return null;
  const loja = exigir(e, "nome");
  const link = linkSeguro(exigir(e, "link"));
  if (!link) throw new DadosInsuficientes("link de recuperação inválido");
  const texto = [
    `Olá!`,
    ``,
    `Você pediu para redefinir a senha do painel da ${loja}.`,
    `Abra este endereço para escolher uma senha nova:`,
    ``,
    link,
    ``,
    `Se não foi você quem pediu, ignore este e-mail: a senha atual continua valendo.`,
  ].join("\n");
  return {
    para,
    assunto: `Redefinir a senha do painel — ${loja}`,
    texto,
    html: pagina(
      "Redefinir a senha do painel",
      p(`Você pediu para redefinir a senha do painel da <b>${escapar(loja)}</b>.`) + botao(link, "Escolher uma senha nova"),
      "Se não foi você quem pediu, ignore este e-mail: a senha atual continua valendo.",
    ),
  };
}

function voltouAoEstoque(e: Envelope): EmailDoEvento | null {
  const para = texto(e, "destinatario");
  if (!enderecoValido(para)) return null;
  const produto = exigir(e, "produtoNome");
  const loja = exigir(e, "nome");
  const url = linkSeguro(texto(e, "url"));
  const preco = inteiro(e, "precoCentavos");
  const linhas = [`Olá!`, ``, `${produto} voltou ao estoque na ${loja}.`];
  if (preco !== null && preco > 0) linhas.push(`Preço: ${brl(preco)}.`);
  if (url) linhas.push(``, url);
  return {
    para,
    assunto: `${produto} voltou ao estoque`,
    texto: linhas.join("\n"),
    html: pagina(
      `${produto} voltou ao estoque`,
      p(`Na <b>${escapar(loja)}</b>.`) +
        (preco !== null && preco > 0 ? p(`Preço: <b>${brl(preco)}</b>.`) : "") +
        (url ? botao(url, "Ver na loja") : ""),
      "Você recebeu este aviso porque pediu para ser avisado quando este produto voltasse.",
    ),
    ...daLoja(e),
  };
}

/** Os quatro avisos de andamento do pedido têm a mesma forma; só muda a frase. */
function andamentoDoPedido(
  e: Envelope,
  opcoes: { assunto: (numero: string) => string; titulo: string; frase: string; rodape?: string; extra?: string },
): EmailDoEvento | null {
  const para = texto(e, "clienteEmail");
  if (!enderecoValido(para)) return null;
  const numero = String(inteiro(e, "numero") ?? exigir(e, "referencia"));
  const loja = exigir(e, "lojaNome");
  const link = linkSeguro(texto(e, "linkPedido"));
  const nome = texto(e, "clienteNome");
  const linhas = [nome ? `Olá, ${nome}!` : "Olá!", ``, `${opcoes.frase} na ${loja}.`];
  if (opcoes.extra) linhas.push(opcoes.extra);
  if (link) linhas.push(``, `Acompanhe pelo pedido: ${link}`);
  return {
    para,
    assunto: opcoes.assunto(numero),
    texto: linhas.join("\n"),
    html: pagina(
      opcoes.titulo,
      p(`${escapar(opcoes.frase)} na <b>${escapar(loja)}</b>.`) +
        (opcoes.extra ? p(escapar(opcoes.extra)) : "") +
        (link ? botao(link, "Acompanhar o pedido") : ""),
      opcoes.rodape ?? `Pedido ${escapar(numero)} · ${escapar(loja)}`,
    ),
    ...daLoja(e),
  };
}

function pedidoEmSeparacao(e: Envelope) {
  return andamentoDoPedido(e, {
    assunto: (n) => `Pedido ${n} em separação`,
    titulo: "Seu pedido está sendo separado",
    frase: "Seu pedido entrou em separação",
  });
}

function pedidoEnviado(e: Envelope) {
  const transportadora = texto(e, "transportadora");
  const rastreio = texto(e, "rastreio");
  const detalhe = [transportadora ? `Transportadora: ${transportadora}.` : null, rastreio ? `Código de rastreio: ${rastreio}.` : null]
    .filter(Boolean)
    .join(" ");
  return andamentoDoPedido(e, {
    assunto: (n) => `Pedido ${n} enviado`,
    titulo: "Seu pedido foi enviado",
    frase: "Seu pedido saiu para entrega",
    extra: detalhe || undefined,
  });
}

function pedidoEntregue(e: Envelope) {
  return andamentoDoPedido(e, {
    assunto: (n) => `Pedido ${n} entregue`,
    titulo: "Seu pedido foi entregue",
    frase: "Seu pedido consta como entregue",
    extra: "Se alguma coisa não estiver certa, responda este e-mail.",
  });
}

function pedidoCancelado(e: Envelope) {
  const total = inteiro(e, "totalCentavos");
  const motivo = texto(e, "motivo");
  return andamentoDoPedido(e, {
    assunto: (n) => `Pedido ${n} cancelado`,
    titulo: "Seu pedido foi cancelado",
    frase: "Seu pedido foi cancelado",
    extra: [motivo ? `Motivo: ${motivo}.` : null, total !== null && total > 0 ? `Valor: ${brl(total)}.` : null]
      .filter(Boolean)
      .join(" ") || undefined,
  });
}

function pixPendente(e: Envelope): EmailDoEvento | null {
  const para = texto(e, "clienteEmail");
  if (!enderecoValido(para)) return null;
  const loja = exigir(e, "lojaNome");
  const numero = String(inteiro(e, "numero") ?? exigir(e, "referencia"));
  const total = inteiro(e, "totalCentavos") ?? 0;
  const link = linkDoPedido(e);
  const linhas = [
    texto(e, "clienteNome") ? `Olá, ${texto(e, "clienteNome")}!` : "Olá!",
    ``,
    `Seu pedido na ${loja} ainda está aguardando o pagamento do Pix.`,
    `Total: ${brl(total)}`,
  ];
  if (link) linhas.push(``, `O código está aqui: ${link}`);
  return {
    para,
    assunto: `Pedido ${numero}: o Pix ainda não foi pago`,
    texto: linhas.join("\n"),
    html: pagina(
      "O Pix ainda não foi pago",
      p(`Seu pedido na <b>${escapar(loja)}</b> continua aguardando o pagamento.`) +
        p(`Total: <b>${brl(total)}</b>`) +
        (link ? botao(link, "Ver o código Pix") : ""),
      "O código expira depois de um tempo. Se o seu já expirou, responda este e-mail.",
    ),
    ...daLoja(e),
  };
}

function indicacoes(e: Envelope): EmailDoEvento | null {
  const para = texto(e, "emailContato");
  if (!enderecoValido(para)) return null;
  const loja = exigir(e, "nome");
  const texto0 = [
    `Olá!`,
    ``,
    `Tudo certo com a ${loja}?`,
    ``,
    `Para manter o valor promocional do setup, combinamos 2 indicações (nome e`,
    `telefone) de quem também pode querer vender pela internet. Pode responder`,
    `este e-mail com elas. Obrigado!`,
  ].join("\n");
  return {
    para,
    assunto: `${loja}: as duas indicações que combinamos`,
    texto: texto0,
    html: pagina(
      "Como está indo?",
      p(`Tudo certo com a <b>${escapar(loja)}</b>?`) +
        p(
          "Para manter o valor promocional do setup, combinamos 2 indicações (nome e telefone) de quem também pode querer vender pela internet. É só responder este e-mail.",
        ),
      "Obrigado!",
    ),
  };
}

function relatorioSemanal(e: Envelope): EmailDoEvento | null {
  const para = texto(e, "emailContato");
  if (!enderecoValido(para)) return null;
  const loja = exigir(e, "nome");
  const periodo = exigir(e, "periodo");
  const pedidos = inteiro(e, "pedidosPagos") ?? 0;
  const receita = inteiro(e, "receitaCentavos") ?? 0;
  const ticket = inteiro(e, "ticketMedioCentavos") ?? 0;
  const carrinhos = inteiro(e, "carrinhosAbandonados") ?? 0;
  const avaliacoes = inteiro(e, "novasAvaliacoes") ?? 0;
  const top = texto(e, "topProdutos");
  const url = linkSeguro(texto(e, "url"));

  const linhas = [
    `${loja} — a semana de ${periodo}`,
    ``,
    `Pedidos pagos: ${pedidos}`,
    `Receita: ${brl(receita)}`,
    `Ticket médio: ${brl(ticket)}`,
    `Carrinhos abandonados: ${carrinhos}`,
    `Novas avaliações: ${avaliacoes}`,
  ];
  if (top && top !== "-") linhas.push(`Mais vendidos: ${top}`);
  if (url) linhas.push(``, url);

  const linha = (rotulo: string, valor: string) =>
    `<tr><td style="padding:6px 0;font-size:15px;color:#6e6e73">${escapar(rotulo)}</td><td style="padding:6px 0;font-size:15px;text-align:right"><b>${escapar(valor)}</b></td></tr>`;

  return {
    para,
    assunto: `${loja}: a semana de ${periodo}`,
    texto: linhas.join("\n"),
    html: pagina(
      `A semana de ${periodo}`,
      p(`Como foi a <b>${escapar(loja)}</b> nos últimos sete dias.`) +
        '<table role="presentation" width="100%" cellpadding="0" cellspacing="0">' +
        linha("Pedidos pagos", String(pedidos)) +
        linha("Receita", brl(receita)) +
        linha("Ticket médio", brl(ticket)) +
        linha("Carrinhos abandonados", String(carrinhos)) +
        linha("Novas avaliações", String(avaliacoes)) +
        "</table>" +
        (top && top !== "-" ? p(`Mais vendidos: ${escapar(top)}`) : "") +
        (url ? botao(url, "Abrir a loja") : ""),
      "Relatório automático da plataforma Avila Ops.",
    ),
  };
}
