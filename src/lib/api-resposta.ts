import type { ZodType } from "zod";

/**
 * O contrato de resposta da API para desenvolvedores, num lugar só.
 *
 * Toda rota de `/api/v1` responde no mesmo formato, para que o cliente escreva
 * um tratador de erro e uma paginação, e não um por rota:
 *
 *   sucesso   { "dados": … }                       objeto
 *             { "dados": [ … ], "paginacao": {…} } lista
 *   erro      { "erro": { "codigo", "mensagem" }, "requisicao": "<id>" }
 *
 * `codigo` é estável e é o que o código do cliente compara; `mensagem` é para
 * gente e pode mudar de texto. Dinheiro sai em centavos inteiros, como em
 * todo o resto da plataforma. Ver docs/API.md.
 */

export const CODIGOS_DE_ERRO = {
  chave_ausente: 401,
  chave_invalida: 401,
  chave_revogada: 401,
  escopo_insuficiente: 403,
  plano_sem_api: 403,
  loja_fora_do_ar: 403,
  parametro_invalido: 400,
  nao_encontrado: 404,
  limite_excedido: 429,
  erro_interno: 500,
} as const;

export type CodigoDeErro = keyof typeof CODIGOS_DE_ERRO;

export class ErroApi extends Error {
  constructor(
    public codigo: CodigoDeErro,
    mensagem: string,
    public cabecalhos: Record<string, string> = {},
  ) {
    super(mensagem);
    this.name = "ErroApi";
  }

  get status(): number {
    return CODIGOS_DE_ERRO[this.codigo];
  }
}

export function corpoDeErro(codigo: CodigoDeErro, mensagem: string, requisicao: string) {
  return { erro: { codigo, mensagem }, requisicao };
}

export interface Paginacao {
  pagina: number;
  porPagina: number;
  /** Quantos pular no banco: (pagina - 1) * porPagina. */
  pular: number;
}

export const POR_PAGINA_PADRAO = 50;
export const POR_PAGINA_MAXIMO = 100;

/**
 * `?pagina=` e `?porPagina=`, validados.
 *
 * Número fora da faixa é erro, não correção silenciosa: quem pede 500 por
 * página e recebe 100 sem aviso conclui que a loja tem 100 produtos.
 */
export function lerPaginacao(params: URLSearchParams): Paginacao {
  const pagina = inteiroDe(params, "pagina", 1);
  const porPagina = inteiroDe(params, "porPagina", POR_PAGINA_PADRAO);
  if (pagina < 1) throw new ErroApi("parametro_invalido", "`pagina` começa em 1.");
  if (porPagina < 1 || porPagina > POR_PAGINA_MAXIMO) {
    throw new ErroApi("parametro_invalido", `\`porPagina\` vai de 1 a ${POR_PAGINA_MAXIMO}.`);
  }
  return { pagina, porPagina, pular: (pagina - 1) * porPagina };
}

function inteiroDe(params: URLSearchParams, nome: string, padrao: number): number {
  const bruto = params.get(nome);
  if (bruto == null || bruto === "") return padrao;
  if (!/^\d+$/.test(bruto)) throw new ErroApi("parametro_invalido", `\`${nome}\` precisa ser um número inteiro.`);
  return Number(bruto);
}

/** `true`/`false` na query; ausente é nulo, qualquer outra coisa é erro. */
export function lerBooleano(params: URLSearchParams, nome: string): boolean | null {
  const bruto = params.get(nome);
  if (bruto == null || bruto === "") return null;
  if (bruto === "true") return true;
  if (bruto === "false") return false;
  throw new ErroApi("parametro_invalido", `\`${nome}\` aceita \`true\` ou \`false\`.`);
}

/** Valor que precisa estar numa lista fechada (status, ordem). */
export function lerOpcao<T extends string>(params: URLSearchParams, nome: string, opcoes: readonly T[]): T | null {
  const bruto = params.get(nome);
  if (bruto == null || bruto === "") return null;
  if (!(opcoes as readonly string[]).includes(bruto)) {
    throw new ErroApi("parametro_invalido", `\`${nome}\` aceita: ${opcoes.join(", ")}.`);
  }
  return bruto as T;
}

/** Data ISO 8601 (`2026-10-01` ou `2026-10-01T12:00:00Z`); ausente é nulo. */
export function lerData(params: URLSearchParams, nome: string): Date | null {
  const bruto = params.get(nome);
  if (bruto == null || bruto === "") return null;
  const data = /^\d{4}-\d{2}-\d{2}/.test(bruto) ? new Date(bruto) : new Date(NaN);
  if (Number.isNaN(data.getTime())) throw new ErroApi("parametro_invalido", `\`${nome}\` precisa ser uma data ISO 8601.`);
  return data;
}

/**
 * Corpo JSON validado pelo esquema da rota.
 *
 * O primeiro problema vai na mensagem, com o caminho do campo
 * (`itens.3.estoque`): em lote de cem itens, "corpo inválido" não diz qual.
 */
export async function lerCorpo<T>(request: Request, esquema: ZodType<T>): Promise<T> {
  let bruto: unknown;
  try {
    bruto = await request.json();
  } catch {
    throw new ErroApi("parametro_invalido", "O corpo precisa ser JSON válido.");
  }
  const lido = esquema.safeParse(bruto);
  if (!lido.success) {
    const problema = lido.error.issues[0];
    const caminho = problema?.path.join(".");
    throw new ErroApi("parametro_invalido", caminho ? `\`${caminho}\`: ${problema.message}` : problema?.message ?? "Corpo inválido.");
  }
  return lido.data;
}

export function lista<T>(dados: T[], p: Paginacao, total: number) {
  return {
    dados,
    paginacao: { pagina: p.pagina, porPagina: p.porPagina, total, totalPaginas: Math.ceil(total / p.porPagina) },
  };
}
