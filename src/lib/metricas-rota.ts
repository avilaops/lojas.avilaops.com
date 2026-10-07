import { HOST_SEM_LOJA, registroGlobal, type Amostra, type Grupo, type RegistroDeMetricas } from "./metricas-tenant";

/**
 * Envoltório de rota: mede a duração e o status do que o manipulador devolve
 * e registra por host. Não muda a resposta, não engole erro.
 *
 *   export const POST = medirRota("frete", async (request) => { ... });
 *
 * Sem `next/*`, para o teste rodar sem servidor: o host sai do próprio
 * `Request`, na mesma ordem de `tenantAtual` (`x-forwarded-host`, depois `host`).
 */

/** Marca do erro que já foi contado aqui, para o `onRequestError` não contar de novo. */
export const ERRO_CONTADO = Symbol.for("lojas.metricas.contado");

export function erroJaContado(erro: unknown): boolean {
  return typeof erro === "object" && erro !== null && (erro as Record<symbol, unknown>)[ERRO_CONTADO] === true;
}

export interface OpcoesDeMedicao {
  /**
   * Host a registrar quando o da requisição não é o da loja (webhook que chega
   * pelo host da plataforma). `null` ou vazio cai em `_sem-loja`.
   */
  host?: (request: Request) => string | null;
  /** Só para teste; em produção é o registro global do processo. */
  registro?: Pick<RegistroDeMetricas, "registrar">;
}

/** Registrar métrica nunca derruba a requisição: falha aqui é engolida de propósito. */
export function registrarSemDerrubar(amostra: Amostra, registro: Pick<RegistroDeMetricas, "registrar"> = registroGlobal()): void {
  try {
    registro.registrar(amostra);
  } catch {
    // Sem log: a mensagem de um erro daqui não diz nada ao lojista, e logar por requisição afoga o resto.
  }
}

function hostDaRequisicao(request: Request, opcoes: OpcoesDeMedicao): string | null {
  try {
    if (opcoes.host) return opcoes.host(request) || HOST_SEM_LOJA;
    return request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  } catch {
    return null;
  }
}

export function medirRota<R extends Request, A extends unknown[]>(
  grupo: Grupo,
  manipulador: (request: R, ...resto: A) => Response | Promise<Response>,
  opcoes: OpcoesDeMedicao = {},
): (request: R, ...resto: A) => Promise<Response> {
  return async function (request, ...resto) {
    const inicio = performance.now();
    const registrar = (status: number) =>
      registrarSemDerrubar({ host: hostDaRequisicao(request, opcoes), grupo, status, duracaoMs: performance.now() - inicio }, opcoes.registro);
    try {
      const resposta = await manipulador(request, ...resto);
      registrar(resposta.status);
      return resposta;
    } catch (erro) {
      registrar(500);
      if (typeof erro === "object" && erro !== null) {
        try {
          Object.defineProperty(erro, ERRO_CONTADO, { value: true, enumerable: false, configurable: true });
        } catch {
          // Erro congelado: fica sem marca e pode contar duas vezes; perder a resposta seria pior.
        }
      }
      throw erro;
    }
  };
}

const BASE = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();
const SLUG = /^[a-z0-9][a-z0-9-]{0,62}$/;

/** `<slug>.<LOJAS_BASE_DOMAIN>`: o endereço que sempre resolve para a loja. */
export function hostDoSlug(slug: string | null | undefined): string | null {
  const limpo = (slug ?? "").toLowerCase();
  return SLUG.test(limpo) ? `${limpo}.${BASE}` : null;
}

/** Webhook: a loja vem de `?loja=`. Só o slug é lido da query; o resto dela é descartado. */
export function hostDoWebhook(request: Request): string | null {
  return hostDoSlug(new URL(request.url).searchParams.get("loja"));
}
