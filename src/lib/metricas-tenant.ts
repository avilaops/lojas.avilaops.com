/**
 * Latência e erros por loja, na memória do processo.
 *
 * Módulo puro, de propósito: é carregado pelo `instrumentation.ts`, então não
 * importa `prisma`, `next/*` nem `./tenant`. Quem casa host com loja é o
 * relatório (`metricas-relatorio.ts`), na leitura — resolver o tenant a cada
 * registro seria uma consulta a mais por requisição e outra no caminho de erro.
 *
 * Em memória pelo mesmo motivo do `api-limite.ts`: a plataforma roda num
 * container só, e uma linha por requisição no Postgres custaria escrita no
 * caminho do checkout. O preço é que estes números zeram a cada deploy
 * (`processoDesde` diz desde quando valem).
 *
 * O que entra aqui é só host, grupo, status e duração. Caminho, query,
 * cabeçalho, cookie, IP, user-agent, corpo e mensagem de erro não têm por onde
 * entrar: a assinatura de `registrar` não os aceita. Ver docs/METRICAS.md.
 */

/** Lista fechada: grupo novo entra aqui, e o que não está aqui não compila. */
export const GRUPOS = ["checkout", "frete", "busca", "webhook", "api-v1", "mcp", "render", "acao", "outra"] as const;
export type Grupo = (typeof GRUPOS)[number];

/** Limite superior de cada balde do histograma, em ms. O último balde é "acima de 5000". */
export const LIMITES_MS = [25, 50, 100, 250, 500, 1000, 2500, 5000] as const;
const BALDES_DO_HISTOGRAMA = LIMITES_MS.length + 1;

const MINUTO_MS = 60_000;
export const RETENCAO_MINUTOS = 60;
/**
 * O host vem de cabeçalho e pode ser forjado: sem teto, um laço mandando
 * `Host` aleatório é memória sem limite. O excedente soma em `_outros`.
 */
export const MAXIMO_DE_HOSTS = 500;

export const HOST_OUTROS = "_outros";
export const HOST_SEM_HOST = "_sem-host";
/** Requisição da API que não chegou a ter loja (chave ausente ou inválida). */
export const HOST_SEM_LOJA = "_sem-loja";

export interface Amostra {
  host: string | null | undefined;
  grupo: Grupo;
  status: number;
  duracaoMs: number;
}

export interface Percentil {
  /** Limite superior do balde onde o percentil cai; `null` sem amostra. */
  ms: number | null;
  /** O percentil caiu acima do último limite: `ms` é o teto, não a medida. */
  acimaDoTeto: boolean;
}

export interface MedidaDoGrupo {
  requisicoes: number;
  erros: number;
  /** Contagem por balde de `LIMITES_MS`, mais um no fim para o que passou do teto. */
  histograma: number[];
  p50Ms: number | null;
  p95Ms: number | null;
  acimaDoTeto: boolean;
}

export interface ResumoDeMetricas {
  /** Instante (ms) em que o registro nasceu: a operação vale só daqui para a frente. */
  processoDesde: number;
  janelaMinutos: number;
  hosts: Record<string, Partial<Record<Grupo, MedidaDoGrupo>>>;
}

/** A mesma leitura de `normalizarHost` (`src/lib/tenant.ts`), mais o `www.`. */
export function chaveDoHost(host: string | null | undefined): string {
  const bruto = (host ?? "").trim();
  // Teto do cabeçalho cru: 253 do nome, mais "www.", o ponto final e ":65535". Sem ele, uma porta longa passaria pelo corte abaixo.
  if (bruto.length > 264) return HOST_OUTROS;
  const limpo = bruto.toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "").replace(/^www\./, "");
  // Nome DNS tem no máximo 253 caracteres: acima disso é cabeçalho forjado e não ganha chave própria.
  if (limpo.length > 253) return HOST_OUTROS;
  return limpo || HOST_SEM_HOST;
}

export function percentil(histograma: readonly number[], p: number): Percentil {
  const total = histograma.reduce((s, n) => s + n, 0);
  if (!total) return { ms: null, acimaDoTeto: false };
  const alvo = Math.max(1, Math.ceil(p * total));
  let acumulado = 0;
  for (let i = 0; i < histograma.length; i++) {
    acumulado += histograma[i];
    if (acumulado >= alvo) {
      return i < LIMITES_MS.length ? { ms: LIMITES_MS[i], acimaDoTeto: false } : { ms: LIMITES_MS[LIMITES_MS.length - 1], acimaDoTeto: true };
    }
  }
  return { ms: LIMITES_MS[LIMITES_MS.length - 1], acimaDoTeto: true };
}

/** Fecha a conta de um grupo a partir dos contadores. O relatório usa a mesma função depois de somar hosts. */
export function medidaDoGrupo(requisicoes: number, erros: number, histograma: readonly number[]): MedidaDoGrupo {
  const p50 = percentil(histograma, 0.5);
  const p95 = percentil(histograma, 0.95);
  return { requisicoes, erros, histograma: [...histograma], p50Ms: p50.ms, p95Ms: p95.ms, acimaDoTeto: p50.acimaDoTeto || p95.acimaDoTeto };
}

function baldeDaDuracao(duracaoMs: number): number {
  const i = LIMITES_MS.findIndex((limite) => duracaoMs <= limite);
  return i === -1 ? LIMITES_MS.length : i;
}

interface Celula {
  requisicoes: number;
  erros: number;
  histograma: number[];
}

type Minuto = Map<string, Partial<Record<Grupo, Celula>>>;

export class RegistroDeMetricas {
  private minutos = new Map<number, Minuto>();
  /** Host → último minuto em que apareceu. É o que o teto conta. */
  private hosts = new Map<string, number>();
  readonly processoDesde: number;

  constructor(private agora: () => number = Date.now, nascimento: number = agora()) {
    this.processoDesde = nascimento;
  }

  registrar({ host, grupo, status, duracaoMs }: Amostra): void {
    const celula = this.celula(host, grupo);
    celula.requisicoes += 1;
    if (status >= 500) celula.erros += 1;
    celula.histograma[baldeDaDuracao(Number.isFinite(duracaoMs) ? Math.max(0, duracaoMs) : 0)] += 1;
  }

  /**
   * Erro que chegou sem duração (o `onRequestError` do Next não a informa):
   * conta requisição e erro, e fica fora do histograma — um zero inventado
   * puxaria o p50 da loja para baixo justamente quando ela está falhando.
   */
  registrarErro({ host, grupo }: Pick<Amostra, "host" | "grupo">): void {
    const celula = this.celula(host, grupo);
    celula.requisicoes += 1;
    celula.erros += 1;
  }

  resumo({ minutos = RETENCAO_MINUTOS }: { minutos?: number } = {}): ResumoDeMetricas {
    const janela = Math.min(RETENCAO_MINUTOS, Math.max(1, Math.floor(minutos)));
    const atual = this.minutoAtual();
    this.descartarVencidos(atual);

    const soma = new Map<string, Partial<Record<Grupo, Celula>>>();
    for (const [minuto, porHost] of this.minutos) {
      if (minuto <= atual - janela) continue;
      for (const [host, grupos] of porHost) {
        const destino = soma.get(host) ?? {};
        soma.set(host, destino);
        for (const grupo of GRUPOS) {
          const origem = grupos[grupo];
          if (!origem) continue;
          const d = (destino[grupo] ??= celulaVazia());
          d.requisicoes += origem.requisicoes;
          d.erros += origem.erros;
          origem.histograma.forEach((n, i) => (d.histograma[i] += n));
        }
      }
    }

    const hosts: ResumoDeMetricas["hosts"] = {};
    for (const [host, grupos] of soma) {
      hosts[host] = {};
      for (const grupo of GRUPOS) {
        const c = grupos[grupo];
        if (c) hosts[host][grupo] = medidaDoGrupo(c.requisicoes, c.erros, c.histograma);
      }
    }
    return { processoDesde: this.processoDesde, janelaMinutos: janela, hosts };
  }

  private minutoAtual(): number {
    return Math.floor(this.agora() / MINUTO_MS);
  }

  private celula(hostBruto: string | null | undefined, grupo: Grupo): Celula {
    const atual = this.minutoAtual();
    let porHost = this.minutos.get(atual);
    if (!porHost) {
      // Minuto novo é a hora barata de varrer: acontece no máximo uma vez por minuto.
      this.descartarVencidos(atual);
      porHost = new Map();
      this.minutos.set(atual, porHost);
    }
    const host = this.hostDentroDoTeto(chaveDoHost(hostBruto), atual);
    let grupos = porHost.get(host);
    if (!grupos) {
      grupos = {};
      porHost.set(host, grupos);
    }
    return (grupos[grupo] ??= celulaVazia());
  }

  private hostDentroDoTeto(host: string, atual: number): string {
    if (host === HOST_OUTROS) return host;
    if (!this.hosts.has(host) && this.hosts.size >= MAXIMO_DE_HOSTS) {
      for (const [h, ultimo] of this.hosts) if (ultimo <= atual - RETENCAO_MINUTOS) this.hosts.delete(h);
      if (this.hosts.size >= MAXIMO_DE_HOSTS) return HOST_OUTROS;
    }
    this.hosts.set(host, atual);
    return host;
  }

  private descartarVencidos(atual: number): void {
    for (const minuto of this.minutos.keys()) if (minuto <= atual - RETENCAO_MINUTOS) this.minutos.delete(minuto);
  }
}

function celulaVazia(): Celula {
  return { requisicoes: 0, erros: 0, histograma: new Array<number>(BALDES_DO_HISTOGRAMA).fill(0) };
}

/**
 * Uma instância por processo, guardada no `globalThis`. `Map` em escopo de
 * módulo não serve: no build standalone rota, página e instrumentation são
 * bundles separados, cada um com sua cópia deste módulo — é o bug descrito no
 * topo de `src/lib/tenant.ts`. Seriam três registros, e a rota de leitura
 * nunca veria o que a rota medida escreveu.
 */
const CHAVE_GLOBAL = Symbol.for("lojas.metricas");

export function registroGlobal(): RegistroDeMetricas {
  const g = globalThis as unknown as Record<symbol, RegistroDeMetricas | undefined>;
  // O registro nasce na primeira requisição medida, mas conta desde que o
  // processo subiu: é esse o instante que diz ao leitor quando foi o deploy.
  return (g[CHAVE_GLOBAL] ??= new RegistroDeMetricas(Date.now, Math.round(performance.timeOrigin)));
}
