import type { OpcaoFrete } from "@avilaops/checkout";
import type { Tenant } from "@prisma/client";
import { recursoAtivo } from "./recursos";

/**
 * Cotação de frete pelo Melhor Envio.
 *
 * A conta é do lojista: ele conecta por OAuth na seção Entrega do painel
 * (`melhor-envio-conta.ts`) e é o token dele que cota. Este arquivo só conhece
 * o contrato da API e não toca no banco, para a leitura da resposta poder ser
 * testada sem rede nem Postgres.
 *
 * Três detalhes do contrato que custam:
 *   - `User-Agent` com nome da aplicação e e-mail de contato é obrigatório; sem
 *     ele a API recusa a chamada, por mais que o token esteja certo;
 *   - a resposta é uma **lista** de serviços, e o que não atende o trecho vem na
 *     mesma lista com um campo `error` em vez de sumir;
 *   - o ambiente de testes é outro domínio (`sandbox.melhorenvio.com.br`), com
 *     outro aplicativo — `MELHOR_ENVIO_URL` troca um pelo outro.
 */
const PRODUCAO = "https://melhorenvio.com.br";
const SANDBOX = "https://sandbox.melhorenvio.com.br";

export function baseDoMelhorEnvio(): string {
  const base = (process.env.MELHOR_ENVIO_URL?.trim() || SANDBOX).replace(/\/+$/, "");
  if (![PRODUCAO, SANDBOX].includes(base)) {
    throw new Error("MELHOR_ENVIO_URL deve apontar para produção ou sandbox oficiais.");
  }
  return base;
}

export function ambienteDoMelhorEnvio(): "sandbox" | "producao" {
  return baseDoMelhorEnvio() === SANDBOX ? "sandbox" : "producao";
}

/** O sandbox compartilhado só pode atender as lojas de teste autorizadas. */
export function lojaPermitidaNoMelhorEnvio(loja: Pick<Tenant, "recursos">): boolean {
  if (ambienteDoMelhorEnvio() === "producao") return true;
  return recursoAtivo(loja, "frete_melhor_envio_sandbox");
}

/** Cabeçalhos que toda chamada autenticada leva. */
export function cabecalhosDoMelhorEnvio(token: string): Record<string, string> {
  return {
    accept: "application/json",
    "content-type": "application/json",
    authorization: `Bearer ${token}`,
    "user-agent": `Lojas Avila Ops (${process.env.MELHOR_ENVIO_CONTATO || "lojas@avilaops.com"})`,
  };
}

function numero(v: unknown): number | undefined {
  const n = typeof v === "number" ? v
    : typeof v === "string" && /^\d+(?:\.\d+)?$/.test(v.trim()) ? Number(v) : Number.NaN;
  return Number.isFinite(n) ? n : undefined;
}

function prazoDoServico(s: Record<string, unknown>): number | undefined {
  const faixaCustom = s.custom_delivery_range as { max?: unknown } | null;
  const faixa = s.delivery_range as { max?: unknown } | null;
  const prazo = numero(s.custom_delivery_time ?? faixaCustom?.max ?? s.delivery_time ?? faixa?.max);
  return prazo !== undefined && Number.isSafeInteger(prazo) && prazo >= 0 ? prazo : undefined;
}

/**
 * "PAC" e "SEDEX" já dizem de quem são; ".Package" sozinho não diz nada ao
 * comprador, e por isso leva o nome da transportadora na frente.
 */
function nomeDoServico(servico: string, transportadora: string): string {
  if (!transportadora || transportadora.toLowerCase() === "correios") return servico;
  if (servico.toLowerCase().includes(transportadora.toLowerCase())) return servico;
  return `${transportadora} ${servico}`;
}

/**
 * Converte a resposta do Melhor Envio nas opções que o checkout mostra.
 *
 * `custom_price` e `custom_delivery_time` vêm na frente porque já consideram o
 * que a conta configurou (seguro, dias a mais de manuseio); `price` é o valor
 * cru do serviço. Cobrar o cru e pagar o configurado seria a diferença saindo
 * do bolso de quem despacha.
 */
export function extrairCotacoes(dados: unknown): OpcaoFrete[] {
  if (!Array.isArray(dados)) return [];

  const opcoes: OpcaoFrete[] = [];
  for (const bruto of dados) {
    if (!bruto || typeof bruto !== "object" || Array.isArray(bruto)) continue;
    const s = (bruto ?? {}) as Record<string, unknown>;
    if (s.error) continue;

    const id = numero(s.id);
    const preco = numero(s.custom_price ?? s.price);
    const centavos = preco === undefined ? undefined : Math.round(preco * 100);
    const nome = typeof s.name === "string" ? s.name.trim() : "";
    if (id === undefined || !Number.isSafeInteger(id) || id <= 0
      || centavos === undefined || !Number.isSafeInteger(centavos) || centavos <= 0 || !nome) continue;

    const prazo = prazoDoServico(s);
    // Sem prazo publicado não há promessa de entrega verificável no checkout.
    if (prazo === undefined) continue;
    const transportadora = String((s.company as { name?: unknown } | null)?.name ?? "").trim();

    opcoes.push({
      id: `melhorenvio:${id}`,
      nome: nomeDoServico(nome, transportadora),
      preco: centavos,
      prazoDiasUteis: prazo,
    });
  }
  return opcoes.sort((a, b) => a.preco - b.preco);
}

export interface PedidoDeCotacao {
  cepOrigem: string;
  cepDestino: string;
  pesoKg: number;
  caixa: { altura: number; largura: number; comprimento: number };
  /** Valor da mercadoria em reais: é o que a transportadora indeniza. */
  valorDeclarado: number;
}

export interface EnderecoDeEnvio {
  nome: string;
  email: string;
  telefone: string;
  documento: string;
  postalCode: string;
  logradouro: string;
  numero: string;
  complemento?: string | null;
  bairro: string;
  cidade: string;
  uf: string;
}

export interface ProdutoDeEnvio {
  nome: string;
  quantidade: number;
  valorUnitarioCentavos: number;
}

export interface CriarEnvioMelhorEnvio {
  serviceId: number;
  remetente: EnderecoDeEnvio;
  destinatario: EnderecoDeEnvio;
  caixa: { altura: number; largura: number; comprimento: number };
  pesoKg: number;
  valorDeclaradoCentavos: number;
  produtos: ProdutoDeEnvio[];
}

export interface ResultadoCarrinhoMelhorEnvio {
  id: string;
  protocolo: string | null;
  status: string | null;
  raw: Record<string, unknown>;
}

function inteiroPositivo(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d+$/.test(v) ? Number(v) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function respostaObjeto(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
}

async function chamarOperacaoMelhorEnvio<T extends Record<string, unknown>>(
  token: string,
  caminho: string,
  corpo: Record<string, unknown>,
): Promise<T> {
  if (!token) throw new Error("Melhor Envio sem token válido.");
  const r = await fetch(`${baseDoMelhorEnvio()}${caminho}`, {
    method: "POST",
    headers: cabecalhosDoMelhorEnvio(token),
    body: JSON.stringify(corpo),
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
    redirect: "error",
  });
  const dados = respostaObjeto(await r.json().catch(() => ({})));
  if (!r.ok) throw new Error(`Melhor Envio recusou a operação (HTTP ${r.status}).`);
  return dados as T;
}

function pessoaParaApi(p: EnderecoDeEnvio): Record<string, unknown> {
  const documento = p.documento.replace(/\D/g, "");
  return {
    name: p.nome,
    email: p.email,
    phone: p.telefone.replace(/\D/g, ""),
    ...(documento.length === 14 ? { company_document: documento } : { document: documento }),
    postal_code: p.postalCode.replace(/\D/g, ""),
    address: p.logradouro,
    number: p.numero,
    complement: p.complemento || undefined,
    district: p.bairro,
    city: p.cidade,
    state_abbr: p.uf.toUpperCase(),
  };
}

function validarEnvio(p: CriarEnvioMelhorEnvio): void {
  if (!Number.isSafeInteger(p.serviceId) || p.serviceId <= 0) throw new Error("Serviço de frete inválido.");
  if (!p.produtos.length) throw new Error("O envio precisa de ao menos um produto.");
  if (![p.pesoKg, p.caixa.altura, p.caixa.largura, p.caixa.comprimento].every((n) => Number.isFinite(n) && n > 0)) {
    throw new Error("Peso ou dimensões inválidos para o envio.");
  }
  if (!Number.isFinite(p.valorDeclaradoCentavos) || p.valorDeclaradoCentavos < 0) throw new Error("Valor declarado inválido.");
}

/** Insere uma postagem no carrinho do Melhor Envio e não consome saldo. */
export async function adicionarEnvioAoCarrinho(token: string, p: CriarEnvioMelhorEnvio): Promise<ResultadoCarrinhoMelhorEnvio> {
  validarEnvio(p);
  const dados = await chamarOperacaoMelhorEnvio<Record<string, unknown>>(token, "/api/v2/me/cart", {
    service: p.serviceId,
    agency: null,
    from: pessoaParaApi(p.remetente),
    to: pessoaParaApi(p.destinatario),
    products: p.produtos.map((produto) => ({
      name: produto.nome.slice(0, 120),
      quantity: produto.quantidade,
      unitary_value: Number((produto.valorUnitarioCentavos / 100).toFixed(2)),
    })),
    volumes: [{
      height: p.caixa.altura,
      width: p.caixa.largura,
      length: p.caixa.comprimento,
      weight: p.pesoKg,
    }],
    options: { insurance_value: Number((p.valorDeclaradoCentavos / 100).toFixed(2)), receipt: false, own_hand: false },
  });
  const id = texto(dados.id) ?? texto(dados.order_id) ?? texto(dados.shipment_id);
  if (!id) throw new Error("Melhor Envio não devolveu o ID da postagem.");
  return { id, protocolo: texto(dados.protocol), status: texto(dados.status), raw: dados };
}

export async function comprarEnviosMelhorEnvio(token: string, ids: string[]): Promise<Record<string, unknown>> {
  if (!ids.length || ids.some((id) => !/^[\w-]+$/.test(id))) throw new Error("IDs de postagem inválidos.");
  return chamarOperacaoMelhorEnvio(token, "/api/v2/me/shipment/checkout", { orders: ids });
}

export async function gerarEtiquetasMelhorEnvio(token: string, ids: string[]): Promise<Record<string, unknown>> {
  if (!ids.length) throw new Error("Nenhuma postagem informada.");
  return chamarOperacaoMelhorEnvio(token, "/api/v2/me/shipment/generate", { orders: ids });
}

export async function imprimirEtiquetasMelhorEnvio(token: string, ids: string[]): Promise<Record<string, unknown>> {
  if (!ids.length) throw new Error("Nenhuma postagem informada.");
  return chamarOperacaoMelhorEnvio(token, "/api/v2/me/shipment/print", { orders: ids });
}

export async function cancelarEnviosMelhorEnvio(token: string, ids: string[]): Promise<Record<string, unknown>> {
  if (!ids.length) throw new Error("Nenhuma postagem informada.");
  return chamarOperacaoMelhorEnvio(token, "/api/v2/me/shipment/cancel", { orders: ids });
}

export async function rastrearEnviosMelhorEnvio(token: string, ids: string[]): Promise<Record<string, unknown>> {
  if (!ids.length) throw new Error("Nenhuma postagem informada.");
  return chamarOperacaoMelhorEnvio(token, "/api/v2/me/shipment/tracking", { orders: ids });
}

export function lerResultadoRastreioMelhorEnvio(dados: unknown): Array<{ id: string; status: string | null; tracking: string | null; trackingUrl: string | null }> {
  const raiz = respostaObjeto(dados);
  const lista = Array.isArray(dados) ? dados : Array.isArray(raiz.data) ? raiz.data : [];
  return lista.flatMap((item) => {
    const d = respostaObjeto(item);
    const id = texto(d.id) ?? (inteiroPositivo(d.id)?.toString() ?? null);
    return id ? [{ id, status: texto(d.status), tracking: texto(d.tracking), trackingUrl: texto(d.tracking_url) }] : [];
  });
}

/**
 * Cota o trecho com o token da loja. Devolve `null` quando não dá para cotar
 * — API fora do ar ou nenhum serviço atendendo —, e quem chama cai na tabela
 * da loja.
 *
 * A falha vai para o log com o motivo. A cotação da CepCerto falhava calada: a
 * conta ficou sem plano ativo e o checkout passou a oferecer só retirada, sem
 * um erro em lugar nenhum para alguém ver.
 */
export async function cotarMelhorEnvio(token: string, p: PedidoDeCotacao): Promise<OpcaoFrete[] | null> {
  if (!token) return null;
  const origem = p.cepOrigem.replace(/\D/g, "");
  const destino = p.cepDestino.replace(/\D/g, "");
  if (origem.length !== 8 || destino.length !== 8
    || ![p.pesoKg, p.caixa.altura, p.caixa.largura, p.caixa.comprimento].every((n) => Number.isFinite(n) && n > 0)
    || !Number.isFinite(p.valorDeclarado) || p.valorDeclarado < 0) return null;

  // Opcional: restringe aos serviços que a plataforma sabe despachar
  // ("1,2,3,4"). Vazio deixa o Melhor Envio devolver todos os que atendem.
  const servicos = (process.env.MELHOR_ENVIO_SERVICOS ?? "").replace(/[^\d,]/g, "");

  try {
    const r = await fetch(`${baseDoMelhorEnvio()}/api/v2/me/shipment/calculate`, {
      method: "POST",
      headers: cabecalhosDoMelhorEnvio(token),
      body: JSON.stringify({
        from: { postal_code: origem },
        to: { postal_code: destino },
        volumes: [{
          height: p.caixa.altura,
          width: p.caixa.largura,
          length: p.caixa.comprimento,
          weight: p.pesoKg,
          insurance: Number(p.valorDeclarado.toFixed(2)),
        }],
        options: { receipt: false, own_hand: false },
        ...(servicos ? { services: servicos } : {}),
      }),
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
      redirect: "error",
    });

    if (!r.ok) {
      console.error(`[frete] Melhor Envio respondeu HTTP ${r.status}.`);
      return null;
    }

    const dados: unknown = await r.json();
    const cotacoes = extrairCotacoes(dados);
    if (!cotacoes.length) {
      console.error("[frete] Melhor Envio não retornou serviço com preço e prazo válidos.");
      return null;
    }
    return cotacoes;
  } catch {
    console.error("[frete] Melhor Envio indisponível ou configuração inválida.");
    return null;
  }
}
