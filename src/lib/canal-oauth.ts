import type { CanalId } from "./canais";

/**
 * O contrato que cada marketplace conectável cumpre.
 *
 * Os três chamam de OAuth coisas bem diferentes — a Shopee assina cada chamada
 * com HMAC e nem tem `state`, a Amazon devolve o código num parâmetro com outro
 * nome —, e é essa diferença que fica dentro do provedor. Para fora, os três
 * respondem as mesmas quatro perguntas.
 *
 * Provedor não importa `db`: só monta endereço e fala com o canal. É o que
 * deixa a assinatura e a URL de cada um testáveis sem banco.
 */

/** O Mercado Livre fica de fora: a conexão dele mora em `mercadolivre.ts`. */
export type CanalConectavel = Exclude<CanalId, "mercadolivre">;

export interface TokensRenovados {
  accessToken: string;
  refreshToken: string;
  /** Validade do acesso, em segundos a partir de agora. */
  expiraEmSegundos: number;
  /** Validade do refresh. `null` quando o canal não informa prazo. */
  refreshExpiraEmSegundos: number | null;
}

export interface TokensDoCanal extends TokensRenovados {
  /** Como o canal chama a conta (`shop_id`, `selling_partner_id`). */
  contaId: string | null;
  /** O que o lojista reconhece na tela. */
  contaNome: string | null;
}

export interface ProvedorDeCanal {
  canal: CanalConectavel;
  /** `false` quando a plataforma não tem o aplicativo deste canal cadastrado. */
  configurado(): boolean;
  /** Para onde o lojista vai autorizar. `retorno` é a URL cadastrada no aplicativo. */
  urlDeAutorizacao(state: string, retorno: string): string;
  /** `true` quando o retorno diz que o lojista não autorizou. */
  recusou(retorno: URLSearchParams): boolean;
  /** Troca o que veio no retorno pelos tokens. Lança com o motivo quando o canal recusa. */
  trocarCodigo(retorno: URLSearchParams, urlDeRetorno: string): Promise<TokensDoCanal>;
  renovar(refreshToken: string, contaId: string | null): Promise<TokensRenovados>;
}

/** Erro de contrato do canal: a mensagem é dele, e vai para o log, nunca para a URL. */
export class CanalRecusou extends Error {}

/**
 * Lê JSON de uma resposta sem lançar. Canal fora do ar devolve HTML de erro, e
 * um `r.json()` solto trocaria o motivo de verdade por "Unexpected token <".
 */
export async function lerJson<T>(r: Response): Promise<T> {
  return (await r.json().catch(() => ({}))) as T;
}
