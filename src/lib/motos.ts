/**
 * Peças por moto ("fitment"), o coração de qualquer loja de peças e
 * acessórios: o comprador diz qual é a moto dele uma vez e a loja passa a
 * mostrar só o que serve. É o que RevZilla, Partzilla e as grandes lojas
 * brasileiras de motopeças fazem, e o que separa uma loja de peças de uma
 * loja genérica com produtos de moto.
 *
 * Tudo aqui é puro (sem Prisma, sem cookies) para ser usado tanto no servidor
 * quanto no seletor do navegador. A leitura do cookie fica em minha-moto.ts.
 */

/** Uma linha de compatibilidade do produto: serve nessa moto, nesses anos. */
export interface Compatibilidade {
  marca: string;
  modelo: string;
  anoDe?: number;
  anoAte?: number;
}

/** A moto que o comprador escolheu. Ano é opcional: nem todo mundo lembra. */
export interface Moto {
  marca: string;
  modelo: string;
  ano?: number;
}

export const ANO_MIN = 1990;
export const ANO_MAX = new Date().getFullYear() + 1;

/** Nome do cookie que guarda a moto do comprador (um ano; JSON codificado). */
export const COOKIE_MOTO = "minha-moto";

/**
 * Catálogo-base de motos vendidas no Brasil, para o seletor e para o
 * autocomplete do painel. A loja pode cadastrar qualquer outra: o que estiver
 * nos produtos entra no seletor junto com esta lista (ver motosDaLoja).
 */
export const MOTOS_BRASIL: Record<string, string[]> = {
  Honda: [
    "Pop 110i", "Biz 110i", "Biz 125", "CG 125 Fan", "CG 150 Titan", "CG 150 Fan", "CG 160 Titan", "CG 160 Fan", "CG 160 Start", "CG 160 Cargo",
    "NXR 150 Bros", "NXR 160 Bros", "XRE 190", "XRE 300", "Sahara 300", "XR 250 Tornado", "CRF 230F", "CRF 250F",
    "CB 250F Twister", "CB 300R", "CB 300F Twister", "CB 500F", "CB 500X", "CBR 500R", "CB 650R", "CBR 650R", "NC 750X", "CB 1000R",
    "Elite 125", "PCX 150", "PCX 160", "ADV 150", "Africa Twin", "Hornet 600",
  ],
  Yamaha: [
    "Neo 125", "Fluo 125", "NMax 160", "YBR 125", "Factor 125", "Factor 150", "Fazer 150", "Fazer 250", "XTZ 125", "XTZ 150 Crosser",
    "XTZ 250 Lander", "XTZ 250 Ténéré", "MT-03", "YZF R3", "MT-07", "MT-09", "XJ6", "Ténéré 700", "Tracer 900",
  ],
  Kawasaki: ["Ninja 300", "Z300", "Ninja 400", "Z400", "Ninja 650", "Z650", "Versys 650", "Z900", "Ninja ZX-6R", "Versys 1000"],
  Suzuki: ["Burgman 125", "Intruder 125", "Yes 125", "GSR 150i", "V-Strom 650", "GSX-S750", "GSX-R1000", "Hayabusa"],
  BMW: ["G 310 R", "G 310 GS", "F 750 GS", "F 850 GS", "F 900 R", "R 1250 GS", "S 1000 RR"],
  Haojue: ["DK 150", "DR 160", "NK 150", "Chopper Road 150", "Master Ride 150"],
  Shineray: ["Jet 50", "XY 50Q", "Phoenix 50", "SHI 175"],
  Dafra: ["Citycom 300", "Next 300", "Horizon 150", "Maxsym 400", "Cruisym 150"],
  "Royal Enfield": ["Hunter 350", "Classic 350", "Meteor 350", "Himalayan", "Interceptor 650", "Continental GT 650"],
  Triumph: ["Trident 660", "Tiger Sport 660", "Street Triple", "Tiger 900", "Bonneville T120"],
  "Harley-Davidson": ["Iron 883", "Sportster 883", "Sportster S", "Fat Boy", "Street Glide"],
  Ducati: ["Monster", "Scrambler", "Multistrada V4", "Panigale V2"],
  KTM: ["Duke 200", "Duke 390", "Adventure 390", "Duke 890"],
  Bajaj: ["Dominar 160", "Dominar 400", "Pulsar NS200"],
};

function normalizar(s: string): string {
  return s.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/** Lê o JSON do banco sem confiar nele: entrada malformada vira lista vazia. */
export function lerCompatibilidade(bruto: unknown): Compatibilidade[] {
  if (!Array.isArray(bruto)) return [];
  const saida: Compatibilidade[] = [];
  for (const e of bruto) {
    if (!e || typeof e !== "object") continue;
    const { marca, modelo, anoDe, anoAte } = e as Record<string, unknown>;
    if (typeof marca !== "string" || typeof modelo !== "string" || !marca.trim() || !modelo.trim()) continue;
    saida.push({
      marca: marca.trim(),
      modelo: modelo.trim(),
      ...(typeof anoDe === "number" && Number.isFinite(anoDe) ? { anoDe } : {}),
      ...(typeof anoAte === "number" && Number.isFinite(anoAte) ? { anoAte } : {}),
    });
  }
  return saida;
}

export function lerMoto(bruto: unknown): Moto | null {
  if (!bruto || typeof bruto !== "object") return null;
  const { marca, modelo, ano } = bruto as Record<string, unknown>;
  if (typeof marca !== "string" || typeof modelo !== "string" || !marca.trim() || !modelo.trim()) return null;
  const a = typeof ano === "number" ? ano : typeof ano === "string" && ano.trim() ? Number(ano) : undefined;
  return { marca: marca.trim().slice(0, 40), modelo: modelo.trim().slice(0, 60), ...(a && a >= ANO_MIN && a <= ANO_MAX ? { ano: a } : {}) };
}

/** Uma linha de compatibilidade atende a moto? Sem ano na moto, basta marca e modelo. */
export function linhaServe(c: Compatibilidade, moto: Moto): boolean {
  if (normalizar(c.marca) !== normalizar(moto.marca) || normalizar(c.modelo) !== normalizar(moto.modelo)) return false;
  if (moto.ano == null) return true;
  if (c.anoDe != null && moto.ano < c.anoDe) return false;
  if (c.anoAte != null && moto.ano > c.anoAte) return false;
  return true;
}

export type Encaixe = "serve" | "universal" | "nao-serve";

/**
 * Produto sem compatibilidade cadastrada é universal (capacete, óleo,
 * serviço): continua aparecendo, mas depois dos que servem de verdade.
 */
export function encaixe(compatibilidade: unknown, moto: Moto | null): Encaixe {
  const linhas = lerCompatibilidade(compatibilidade);
  if (!moto) return linhas.length ? "serve" : "universal";
  if (!linhas.length) return "universal";
  return linhas.some((c) => linhaServe(c, moto)) ? "serve" : "nao-serve";
}

export function nomeDaMoto(m: Moto): string {
  return `${m.marca} ${m.modelo}${m.ano ? ` ${m.ano}` : ""}`;
}

export function descreverAnos(c: Compatibilidade): string {
  if (c.anoDe != null && c.anoAte != null) return c.anoDe === c.anoAte ? String(c.anoDe) : `${c.anoDe}–${c.anoAte}`;
  if (c.anoDe != null) return `${c.anoDe} em diante`;
  if (c.anoAte != null) return `até ${c.anoAte}`;
  return "todos os anos";
}

/** Junta o catálogo-base com o que a loja cadastrou; marcas e modelos em ordem. */
export function mesclarMotos(daLoja: Record<string, string[]>): Record<string, string[]> {
  const saida: Record<string, Set<string>> = {};
  const add = (marca: string, modelo: string) => {
    const chave = Object.keys(saida).find((k) => normalizar(k) === normalizar(marca)) ?? marca;
    (saida[chave] ??= new Set()).add(modelo);
  };
  for (const [marca, modelos] of Object.entries(daLoja)) for (const m of modelos) add(marca, m);
  for (const [marca, modelos] of Object.entries(MOTOS_BRASIL)) for (const m of modelos) add(marca, m);
  return Object.fromEntries(
    Object.keys(saida)
      .sort((a, b) => a.localeCompare(b, "pt-BR"))
      .map((marca) => [marca, [...saida[marca]].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }))]),
  );
}

/** Query string de /produtos para uma moto (URL própria: compartilhável e indexável). */
export function queryDaMoto(m: Moto): string {
  const q = new URLSearchParams({ marca: m.marca, modelo: m.modelo });
  if (m.ano) q.set("ano", String(m.ano));
  return q.toString();
}
