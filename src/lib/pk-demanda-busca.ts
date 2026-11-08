export type DemandaBuscaPk = { tipo: "codigo" | "medidas" | "familia-material"; consulta: string };
const palavras = new Set(["anel", "guia", "gaxeta", "raspador", "retentor", "oring", "o-ring", "nylon", "fibra", "de", "vidro", "nbr", "poliuretano", "ptfe", "borracha", "viton", "fkm", "b", "bs", "std", "d"]);
const familias = new Set(["anel", "gaxeta", "raspador", "retentor", "oring", "o-ring", "nylon", "nbr", "poliuretano", "ptfe", "borracha", "viton", "fkm"]);

/** Gramática fechada: nunca guarde a busca bruta nem trechos de texto recusado. */
export function normalizarDemandaPk(valor: unknown): DemandaBuscaPk | null {
  if (typeof valor !== "string" || valor.length > 100 || /[@\n\r/:+()]/.test(valor)) return null;
  const texto = valor.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase().replace(/\s+/g, " ");
  if (!texto || /\d{7,}/.test(texto.replace(/[\s.\-]/g, ""))) return null;
  if (/^\d{3,6}$/.test(texto)) return { tipo: "codigo", consulta: texto };
  // Prefixos conhecidos da nomenclatura técnica PK; nomes seguidos de números não entram.
  if (/^(?:gny|pk|w|b|bs|std|d)[- ]?\d{1,6}(?:[-.]\d{1,4}){0,2}$/.test(texto)) return { tipo: "codigo", consulta: texto.toUpperCase().replace(/ /g, "-") };
  if (/^\d+(?:[.,]\d+)?\s*[x×]\s*\d+(?:[.,]\d+)?(?:\s*[x×]\s*\d+(?:[.,]\d+)?)?\s*(?:mm)?$/.test(texto)) {
    const numeros = texto.replace(/mm$/, "").split(/[x×]/).map(v => Number(v.trim().replace(",", ".")));
    if (numeros.every(n => Number.isFinite(n) && n > 0 && n <= 3000)) return { tipo: "medidas", consulta: numeros.join(" x ") + " mm" };
  }
  const tokens = texto.split(" ");
  if (tokens.length <= 6 && tokens.every(p => palavras.has(p)) && tokens.some(p => familias.has(p))) return { tipo: "familia-material", consulta: texto };
  return null;
}

export function chaveDemandaPk(tenantId: string, tenantSlug: string, valor: unknown, agora = new Date()) {
  const demanda = normalizarDemandaPk(valor);
  if (tenantSlug !== "pkvedacoes" || !tenantId || !demanda) return null;
  const diaLocal = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
  return { tenantId, ...demanda, dia: new Date(`${diaLocal}T00:00:00.000Z`) };
}
