import { randomBytes } from "node:crypto";
import { prisma } from "./db";
import { FUSO_ANALYTICS, STATUS_VENDA_ANALYTICS, inicioDoDia, isoLocal, rotuloData, type PeriodoAnalytics } from "./analytics-vendas";

/**
 * Atribuição: de onde vem quem compra.
 *
 * A tela de Análises dizia, com todas as letras, que a medição da vitrine não
 * tinha começado — dava para calcular venda a partir do histórico de pedidos,
 * mas sessão, taxa de conversão e canal de origem não existem retroativamente.
 * Isto aqui é essa medição.
 *
 * ## O que é medido, e o que não é
 *
 * Uma linha por **sessão**, não por clique. A pergunta do painel é por sessão
 * ("quantas entraram, quantas compraram"), e guardar um registro por
 * visualização custaria muito mais para responder exatamente a mesma coisa.
 *
 * A medição é first-party: cookie do próprio domínio da loja, nada sai para
 * terceiros, e nem IP nem user-agent são guardados. `visitante` é um valor
 * sorteado no primeiro acesso, sem relação com identidade — serve só para
 * ligar a sessão de hoje à de ontem, que é o que o "último clique não direto"
 * precisa saber.
 *
 * ## Por que "último clique não direto"
 *
 * É o modelo que a Shopify e o GA mostram por padrão, e o motivo é prático: a
 * mesma pessoa clica no anúncio na segunda, pensa, e volta digitando o
 * endereço na quinta. Atribuir a venda à sessão da compra daria todo o crédito
 * a "Direto" e nenhum ao anúncio que pagou por ela. Então a venda vai para o
 * último canal identificável dentro da janela — e só cai em "Direto" quando
 * realmente não houve nenhum.
 */

/** Quanto tempo atrás um clique ainda leva o crédito da venda. */
export const JANELA_ATRIBUICAO_DIAS = 30;

/** Uma sessão termina após este tempo sem nenhuma página nova. */
export const MINUTOS_DE_SESSAO = 30;

/**
 * Cookies da medição, os dois first-party e opacos.
 *
 * `COOKIE_VISITANTE` só é gravado com "aceito" no banner: ligar a visita de
 * hoje à de ontem é perfil de navegação, e a loja declara que não guarda perfil
 * sem consentimento. Ver src/app/api/vitrine/sessao/route.ts.
 */
export const COOKIE_SESSAO = "av_sessao";
export const COOKIE_VISITANTE = "av_visitante";

export const CANAIS = {
  direto: "Direto",
  "busca-organica": "Busca orgânica",
  "busca-paga": "Busca paga",
  social: "Social",
  "social-pago": "Social pago",
  whatsapp: "WhatsApp",
  email: "E-mail",
  marketplace: "Marketplace",
  referencia: "Indicação de outro site",
} as const;

export type Canal = keyof typeof CANAIS;

/** Como o lojista age sobre cada canal — é o que a tela explica ao lado do número. */
export const AJUDA_CANAL: Record<Canal, string> = {
  direto: "Digitou o endereço, salvou nos favoritos ou veio de um app que não informa a origem",
  "busca-organica": "Achou a loja no Google ou no Bing sem você pagar por isso",
  "busca-paga": "Clicou num anúncio de busca",
  social: "Veio de uma publicação no Instagram, Facebook, TikTok ou YouTube",
  "social-pago": "Clicou num anúncio em rede social",
  whatsapp: "Abriu um link que você mandou por WhatsApp",
  email: "Clicou num link de e-mail marketing",
  marketplace: "Veio de um anúncio seu no Mercado Livre, Shopee ou Amazon",
  referencia: "Outro site linkou para a sua loja",
};

const BUSCADORES = ["google.", "bing.", "duckduckgo.", "yahoo.", "ecosia.", "brave.", "yandex.", "baidu.", "search.marginalia"];
const SOCIAIS = ["instagram.", "facebook.", "fb.", "l.facebook", "tiktok.", "youtube.", "youtu.be", "twitter.", "x.com", "t.co", "linkedin.", "lnkd.in", "pinterest.", "reddit.", "threads."];
const MENSAGEIROS = ["whatsapp.", "wa.me", "web.whatsapp", "t.me", "telegram."];
const MARKETPLACES = ["mercadolivre.", "mercadolibre.", "produto.mercadolivre", "shopee.", "amazon.", "magazineluiza.", "americanas.", "shein.", "olx."];

export interface Origem {
  canal: Canal;
  origem: string | null;
  midia: string | null;
  campanha: string | null;
  termo: string | null;
  conteudo: string | null;
  referrer: string | null;
}

/** Só o host, em minúsculas e sem `www.`. Entrada inválida vira string vazia. */
function hostDe(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

const combina = (host: string, lista: string[]) => lista.some((p) => host.startsWith(p) || host.includes(`.${p}`));

/**
 * De onde veio esta visita.
 *
 * A ordem importa e não é arbitrária: **utm vence referrer**. Quem marcou o
 * link declarou a campanha, e o referrer de um link marcado costuma mentir
 * (link de e-mail aberto no navegador chega sem referrer; link do Instagram
 * chega como `l.instagram.com`). Só quando não há utm o referrer é a melhor
 * informação disponível.
 *
 * `gclid`/`fbclid` entram como último recurso: é o clique de anúncio que
 * chegou sem utm porque alguém esqueceu de marcar, e classificá-lo como
 * orgânico faria o relatório dizer que o anúncio não traz ninguém.
 */
export function classificarOrigem(entrada: {
  parametros: URLSearchParams;
  referrer: string | null;
  /** Host da própria loja: navegação interna não é origem nova. */
  hostDaLoja: string;
}): Origem {
  const p = entrada.parametros;
  const texto = (chave: string) => {
    const v = p.get(chave)?.trim();
    return v ? v.slice(0, 120) : null;
  };

  const source = texto("utm_source");
  const midia = texto("utm_medium");
  const base: Omit<Origem, "canal" | "origem"> = {
    midia,
    campanha: texto("utm_campaign"),
    termo: texto("utm_term"),
    conteudo: texto("utm_content"),
    referrer: entrada.referrer?.slice(0, 300) ?? null,
  };

  const refHost = hostDe(entrada.referrer ?? "");
  // Navegação dentro da própria loja não é origem: só a primeira página conta.
  const referenciaExterna = refHost && refHost !== entrada.hostDaLoja.toLowerCase().replace(/^www\./, "") ? refHost : "";

  if (source || midia) {
    const m = (midia ?? "").toLowerCase();
    const s = (source ?? "").toLowerCase();
    const origem = source ?? referenciaExterna ?? null;
    if (["email", "e-mail", "newsletter", "mail"].includes(m)) return { ...base, canal: "email", origem };
    if (["cpc", "ppc", "paid", "paidsearch", "paid_search", "sem", "adwords", "google_ads"].includes(m)) {
      return { ...base, canal: "busca-paga", origem };
    }
    if (["paid_social", "paidsocial", "social_paid", "cpm", "display", "remarketing"].includes(m)) {
      return { ...base, canal: "social-pago", origem };
    }
    if (m === "social" || combina(s, SOCIAIS.map((x) => x.replace(/\.$/, "")))) return { ...base, canal: "social", origem };
    if (s.includes("whatsapp") || s.includes("telegram")) return { ...base, canal: "whatsapp", origem };
    if (combina(s, MARKETPLACES.map((x) => x.replace(/\.$/, "")))) return { ...base, canal: "marketplace", origem };
    if (m === "organic") return { ...base, canal: "busca-organica", origem };
    return { ...base, canal: "referencia", origem };
  }

  if (referenciaExterna) {
    if (combina(referenciaExterna, BUSCADORES)) return { ...base, canal: "busca-organica", origem: referenciaExterna };
    if (combina(referenciaExterna, MENSAGEIROS)) return { ...base, canal: "whatsapp", origem: referenciaExterna };
    if (combina(referenciaExterna, SOCIAIS)) return { ...base, canal: "social", origem: referenciaExterna };
    if (combina(referenciaExterna, MARKETPLACES)) return { ...base, canal: "marketplace", origem: referenciaExterna };
    return { ...base, canal: "referencia", origem: referenciaExterna };
  }

  // Clique de anúncio que chegou sem utm: classificar como orgânico faria o
  // relatório dizer que o anúncio não traz ninguém.
  if (p.has("gclid") || p.has("gad_source")) return { ...base, canal: "busca-paga", origem: "google" };
  if (p.has("fbclid")) return { ...base, canal: "social-pago", origem: "facebook" };
  if (p.has("ttclid")) return { ...base, canal: "social-pago", origem: "tiktok" };

  return { ...base, canal: "direto", origem: null };
}

/** celular | tablet | computador, do user-agent — que não é guardado. */
export function classificarDispositivo(userAgent: string | null): "celular" | "tablet" | "computador" {
  const ua = (userAgent ?? "").toLowerCase();
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/.test(ua)) return "celular";
  return "computador";
}

/** Valor opaco de cookie: 128 bits, sem nada derivado do visitante. */
export function novaChave(): string {
  return randomBytes(16).toString("base64url");
}

// ── Atribuição de um pedido ─────────────────────────────────────────────

export interface SessaoParaAtribuir {
  id: string;
  visitante: string;
  canal: string;
  origem: string | null;
  campanha: string | null;
  criadoEm: Date;
}

/**
 * Último clique não direto.
 *
 * Recebe as sessões do visitante já ordenadas da mais nova para a mais velha
 * e devolve a que leva o crédito. A regra em três linhas:
 *
 *  1. entre as sessões até a compra, dentro da janela, pega a última que não
 *     é "direto";
 *  2. não havendo nenhuma, fica com a sessão da própria compra;
 *  3. sem sessão nenhuma (pedido anterior à medição, cookie recusado, venda
 *     fora do site), o canal é "direto" — inventar canal seria pior.
 */
export function atribuirPedido(
  sessaoDaCompra: SessaoParaAtribuir | null,
  doVisitante: SessaoParaAtribuir[],
  compradoEm: Date,
  janelaDias = JANELA_ATRIBUICAO_DIAS,
): SessaoParaAtribuir | null {
  if (!sessaoDaCompra) return null;
  const limite = compradoEm.getTime() - janelaDias * 86_400_000;
  const candidata = doVisitante
    .filter((s) => s.criadoEm.getTime() <= compradoEm.getTime() && s.criadoEm.getTime() >= limite && s.canal !== "direto")
    .sort((a, b) => b.criadoEm.getTime() - a.criadoEm.getTime())[0];
  return candidata ?? sessaoDaCompra;
}

// ── Relatório ───────────────────────────────────────────────────────────

export interface LinhaCanal {
  canal: Canal;
  rotulo: string;
  sessoes: number;
  pedidos: number;
  vendasCentavos: number;
  /** Pedidos ÷ sessões, em pontos percentuais. Nulo sem sessão medida. */
  conversao: number | null;
}

export interface RelatorioAtribuicao {
  /** Falso enquanto nenhuma sessão foi medida: a tela não finge gráfico vazio. */
  temMedicao: boolean;
  sessoes: number;
  canais: LinhaCanal[];
  /** Série diária dos cinco canais com mais sessões. */
  serie: Array<{ dia: string; rotulo: string; porCanal: Record<string, number> }>;
  topCanais: Canal[];
  /** Campanhas com utm_campaign, ordenadas por venda. */
  campanhas: Array<{ campanha: string; canal: string; origem: string | null; sessoes: number; pedidos: number; vendasCentavos: number }>;
  /** Pedidos pagos sem sessão: contados como Direto e declarados aqui. */
  pedidosSemSessao: number;
}

const canalValido = (c: string): Canal => (c in CANAIS ? (c as Canal) : "referencia");

export async function relatorioDeAtribuicao(tenantId: string, periodo: PeriodoAnalytics): Promise<RelatorioAtribuicao> {
  const [porCanal, porDia, pedidos] = await Promise.all([
    // Totais de sessão: groupBy, sem teto — é contagem no banco.
    prisma.sessaoVitrine.groupBy({
      by: ["canal"],
      where: { tenantId, criadoEm: { gte: periodo.de, lte: periodo.ate } },
      _count: { _all: true },
    }),
    /**
     * Série diária no fuso da loja. `date_trunc` no banco evita trazer uma
     * linha por sessão só para agrupá-las por dia aqui.
     *
     * Os dois `AT TIME ZONE` não são redundância: o Prisma grava DateTime como
     * `timestamp` SEM fuso, com o valor em UTC. O primeiro diz ao Postgres que
     * aquele horário ingênuo é UTC; o segundo converte para São Paulo. Com um
     * só, uma visita à meia-noite e meia UTC entraria no dia errado.
     *
     * E o dia sai como texto já formatado: devolvê-lo como Date faria o driver
     * reinterpretar o horário local como UTC no caminho de volta, e o relatório
     * inteiro andaria um dia.
     */
    prisma.$queryRaw<Array<{ dia: string; canal: string; total: bigint }>>`
      SELECT to_char(date_trunc('day', ("criadoEm" AT TIME ZONE 'UTC') AT TIME ZONE ${FUSO_ANALYTICS}), 'YYYY-MM-DD') AS dia,
             "canal", COUNT(*) AS total
      FROM "SessaoVitrine"
      WHERE "tenantId" = ${tenantId} AND "criadoEm" >= ${periodo.de} AND "criadoEm" <= ${periodo.ate}
      GROUP BY 1, 2
    `,
    prisma.pedido.findMany({
      where: { tenantId, status: { in: [...STATUS_VENDA_ANALYTICS] }, criadoEm: { gte: periodo.de, lte: periodo.ate } },
      select: { criadoEm: true, totalCentavos: true, sessaoId: true, sessao: { select: { visitante: true } } },
    }),
  ]);

  const visitantes = Array.from(
    new Set(pedidos.map((p) => p.sessao?.visitante).filter((v): v is string => Boolean(v))),
  );
  /**
   * Só as sessões de quem comprou, e só dentro da janela de atribuição.
   *
   * É o que o "último clique não direto" precisa ler. A alternativa — carregar
   * a vitrine inteira do período — traria dezenas de milhares de linhas para
   * atribuir vinte pedidos.
   */
  const historico = visitantes.length
    ? await prisma.sessaoVitrine.findMany({
        where: {
          tenantId,
          visitante: { in: visitantes },
          criadoEm: { gte: new Date(periodo.de.getTime() - JANELA_ATRIBUICAO_DIAS * 86_400_000), lte: periodo.ate },
        },
        select: { id: true, visitante: true, canal: true, origem: true, campanha: true, criadoEm: true },
      })
    : [];

  const porVisitante = new Map<string, SessaoParaAtribuir[]>();
  const porId = new Map<string, SessaoParaAtribuir>();
  for (const s of historico) {
    porId.set(s.id, s);
    const lista = porVisitante.get(s.visitante) ?? [];
    lista.push(s);
    porVisitante.set(s.visitante, lista);
  }

  const vendaPorCanal = new Map<string, { pedidos: number; centavos: number }>();
  const campanhas = new Map<string, { campanha: string; canal: string; origem: string | null; sessoes: number; pedidos: number; vendasCentavos: number }>();
  let pedidosSemSessao = 0;

  for (const pedido of pedidos) {
    const daCompra = pedido.sessaoId ? porId.get(pedido.sessaoId) ?? null : null;
    const creditada = atribuirPedido(daCompra, porVisitante.get(daCompra?.visitante ?? "") ?? [], pedido.criadoEm);
    if (!creditada) pedidosSemSessao++;
    const canal = creditada ? canalValido(creditada.canal) : "direto";
    const atual = vendaPorCanal.get(canal) ?? { pedidos: 0, centavos: 0 };
    vendaPorCanal.set(canal, { pedidos: atual.pedidos + 1, centavos: atual.centavos + pedido.totalCentavos });

    if (creditada?.campanha) {
      const chave = `${creditada.campanha}|${canal}`;
      const c = campanhas.get(chave) ?? { campanha: creditada.campanha, canal, origem: creditada.origem, sessoes: 0, pedidos: 0, vendasCentavos: 0 };
      c.pedidos++;
      c.vendasCentavos += pedido.totalCentavos;
      campanhas.set(chave, c);
    }
  }

  // Sessões por campanha, para a taxa de conversão da campanha fazer sentido.
  if (campanhas.size) {
    const porCampanha = await prisma.sessaoVitrine.groupBy({
      by: ["campanha", "canal"],
      where: { tenantId, criadoEm: { gte: periodo.de, lte: periodo.ate }, campanha: { in: Array.from(campanhas.values()).map((c) => c.campanha) } },
      _count: { _all: true },
    });
    for (const linha of porCampanha) {
      const c = campanhas.get(`${linha.campanha}|${canalValido(linha.canal)}`);
      if (c) c.sessoes = linha._count._all;
    }
  }

  const sessoesPorCanal = new Map(porCanal.map((c) => [canalValido(c.canal), c._count._all]));
  const canais: LinhaCanal[] = (Object.keys(CANAIS) as Canal[])
    .map((canal) => {
      const sessoes = sessoesPorCanal.get(canal) ?? 0;
      const venda = vendaPorCanal.get(canal) ?? { pedidos: 0, centavos: 0 };
      return {
        canal,
        rotulo: CANAIS[canal],
        sessoes,
        pedidos: venda.pedidos,
        vendasCentavos: venda.centavos,
        // Sem sessão medida não existe taxa: 0% seria uma afirmação falsa
        // sobre um canal que talvez tenha vendido.
        conversao: sessoes ? Math.round((venda.pedidos / sessoes) * 1000) / 10 : null,
      };
    })
    .filter((l) => l.sessoes > 0 || l.pedidos > 0)
    .sort((a, b) => b.sessoes - a.sessoes || b.vendasCentavos - a.vendasCentavos);

  const topCanais = canais.slice(0, 5).map((c) => c.canal);
  const totalSessoes = canais.reduce((s, c) => s + c.sessoes, 0);

  // Uma barra por dia do período, inclusive os dias sem visita nenhuma: buraco
  // na série é informação, e pular o dia vazio mente sobre a forma da curva.
  const dias = new Map<string, Record<string, number>>();
  for (let t = periodo.de.getTime(); t <= periodo.ate.getTime(); t += 86_400_000) {
    dias.set(isoLocal(new Date(t)), {});
  }
  for (const linha of porDia) {
    const registro = dias.get(linha.dia);
    if (!registro) continue;
    const canal = canalValido(linha.canal);
    if (topCanais.includes(canal)) registro[canal] = (registro[canal] ?? 0) + Number(linha.total);
  }

  return {
    temMedicao: totalSessoes > 0,
    sessoes: totalSessoes,
    canais,
    topCanais,
    serie: Array.from(dias, ([dia, porCanal]) => ({ dia, rotulo: rotuloData(inicioDoDia(dia)), porCanal })),
    campanhas: Array.from(campanhas.values()).sort((a, b) => b.vendasCentavos - a.vendasCentavos).slice(0, 20),
    pedidosSemSessao,
  };
}
