import { GRUPOS, chaveDoHost, medidaDoGrupo, type Grupo, type ResumoDeMetricas } from "./metricas-tenant";

/**
 * Junta as duas metades das métricas por loja: a operação (latência e erros,
 * da memória do processo, por host) e o negócio (sessões e pedidos das últimas
 * 24 h, do banco). Função pura — quem lê o banco é `metricas-negocio.ts`.
 */

export interface LojaDoRelatorio {
  id: string;
  slug: string;
  nome: string;
  status: string;
  dominios: string[];
}

/** Contagens das últimas 24 h de uma loja. */
export interface Negocio24h {
  sessoes: number;
  pedidosCriados: number;
  /** Pedidos em `STATUS_VENDA_ANALYTICS`, de qualquer canal. */
  pedidosPagos: number;
  /** Os pagos que nasceram numa sessão da vitrine: é o numerador da conversão. */
  pedidosPagosComSessao: number;
}

export interface GrupoDoRelatorio {
  requisicoes: number;
  erros: number;
  p50Ms: number | null;
  p95Ms: number | null;
  /** Presente só quando o percentil passou de 5000 ms: o número é o teto, não a medida. */
  acimaDoTeto?: true;
}

export interface OperacaoDoRelatorio {
  requisicoes: number;
  erros: number;
  /** Percentual com uma casa; `null` sem requisição na janela. */
  taxaErro: number | null;
  porGrupo: Partial<Record<Grupo, GrupoDoRelatorio>>;
}

export interface LojaNoRelatorio {
  slug: string;
  nome: string;
  status: string;
  operacao: OperacaoDoRelatorio;
  negocio24h: {
    sessoes: number;
    pedidosCriados: number;
    pedidosPagos: number;
    /** Percentual com uma casa; `null` sem sessão no período. */
    conversao: number | null;
  };
}

export interface RelatorioDeMetricas {
  medidoEm: string;
  processoDesde: string;
  janelaMinutos: number;
  lojas: LojaNoRelatorio[];
  /** Requisições cujo host não é de nenhuma loja, somadas. O nome do host não sai: pode ser qualquer coisa forjada. */
  semLoja: OperacaoDoRelatorio;
}

type Contadores = Partial<Record<Grupo, { requisicoes: number; erros: number; histograma: number[] }>>;

/**
 * Número que a medição não tem não vira zero (regra do AGENTS.md): sem
 * denominador, a taxa é `null`, e quem lê sabe que não houve o que medir.
 */
export function percentual(parte: number, todo: number): number | null {
  return todo > 0 ? Math.round((parte / todo) * 1000) / 10 : null;
}

function somar(destino: Contadores, origem: ResumoDeMetricas["hosts"][string]): void {
  for (const grupo of GRUPOS) {
    const o = origem[grupo];
    if (!o) continue;
    const d = (destino[grupo] ??= { requisicoes: 0, erros: 0, histograma: o.histograma.map(() => 0) });
    d.requisicoes += o.requisicoes;
    d.erros += o.erros;
    o.histograma.forEach((n, i) => (d.histograma[i] += n));
  }
}

function operacao(contadores: Contadores): OperacaoDoRelatorio {
  const porGrupo: OperacaoDoRelatorio["porGrupo"] = {};
  let requisicoes = 0;
  let erros = 0;
  for (const grupo of GRUPOS) {
    const c = contadores[grupo];
    if (!c) continue;
    const m = medidaDoGrupo(c.requisicoes, c.erros, c.histograma);
    porGrupo[grupo] = { requisicoes: m.requisicoes, erros: m.erros, p50Ms: m.p50Ms, p95Ms: m.p95Ms, ...(m.acimaDoTeto ? { acimaDoTeto: true as const } : {}) };
    requisicoes += c.requisicoes;
    erros += c.erros;
  }
  return { requisicoes, erros, taxaErro: percentual(erros, requisicoes), porGrupo };
}

export function montarRelatorioDeMetricas(
  resumo: ResumoDeMetricas,
  lojas: readonly LojaDoRelatorio[],
  negocio: ReadonlyMap<string, Negocio24h>,
  agora: Date,
  base: string = process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com",
): RelatorioDeMetricas {
  const sufixo = `.${chaveDoHost(base)}`;
  const porSlug = new Map(lojas.map((l) => [l.slug.toLowerCase(), l.id]));
  const porDominio = new Map<string, string>();
  for (const l of lojas) for (const d of l.dominios) porDominio.set(chaveDoHost(d), l.id);

  const porLoja = new Map<string, Contadores>();
  const semLoja: Contadores = {};
  for (const [host, grupos] of Object.entries(resumo.hosts)) {
    const slug = host.endsWith(sufixo) ? host.slice(0, -sufixo.length) : null;
    const id = (slug && !slug.includes(".") ? porSlug.get(slug) : undefined) ?? porDominio.get(host);
    if (!id) {
      somar(semLoja, grupos);
      continue;
    }
    const contadores = porLoja.get(id) ?? {};
    porLoja.set(id, contadores);
    somar(contadores, grupos);
  }

  return {
    medidoEm: agora.toISOString(),
    processoDesde: new Date(resumo.processoDesde).toISOString(),
    janelaMinutos: resumo.janelaMinutos,
    lojas: lojas
      .filter((l) => l.status === "ATIVA" || porLoja.has(l.id))
      .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
      .map((l) => {
        const n = negocio.get(l.id) ?? { sessoes: 0, pedidosCriados: 0, pedidosPagos: 0, pedidosPagosComSessao: 0 };
        return {
          slug: l.slug,
          nome: l.nome,
          status: l.status,
          operacao: operacao(porLoja.get(l.id) ?? {}),
          negocio24h: {
            sessoes: n.sessoes,
            pedidosCriados: n.pedidosCriados,
            pedidosPagos: n.pedidosPagos,
            conversao: percentual(n.pedidosPagosComSessao, n.sessoes),
          },
        };
      }),
    semLoja: operacao(semLoja),
  };
}
