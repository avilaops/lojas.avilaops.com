export const TENANT_PK = "pkvedacoes";
export const LIMITE_COMPARACAO = 3;
export const chaveComparacaoPk = "comparacao:pkvedacoes:v1";
export const eventoComparacaoPk = "pk:comparacao";

export function slugsComparacao(valor: unknown): string[] | null {
  if (!Array.isArray(valor) || valor.length > LIMITE_COMPARACAO || !valor.every(v => typeof v === "string" && /^[a-z0-9][a-z0-9-]{0,199}$/.test(v))) return null;
  return [...new Set(valor)] as string[];
}

export function lerSelecaoPk(valor: string | null): string[] {
  if (!valor) return [];
  try { return slugsComparacao(JSON.parse(valor)) ?? []; } catch { return []; }
}

export function atributosPk(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : {};
}

export function medidasPk(valor: unknown) {
  const a = atributosPk(valor);
  const numero = (v: unknown) => {
    if (typeof v !== "number" && !(typeof v === "string" && /^\d+(?:[.,]\d+)?$/.test(v))) return null;
    const n = typeof v === "number" ? v : Number(v.replace(",", "."));
    return Number.isFinite(n) && n > 0 && n <= 3000 ? n : null;
  };
  const di = numero(a.diametroInternoMm), de = numero(a.diametroExternoMm);
  const coerente = di === null || de === null || de > di;
  return { di: coerente ? di : null, de: coerente ? de : null, altura: numero(a.alturaMm), secao: numero(a.secaoMm) };
}

export function textoAtributoPk(valor: unknown): string {
  return typeof valor === "string" && valor.trim() ? valor.trim() : "Não informado";
}

export function beneficiosPk(tenantSlug: string, nome: string, valor: unknown): string[] {
  if (tenantSlug !== TENANT_PK) return [];
  const a = atributosPk(valor);
  const identidade = `${nome} ${textoAtributoPk(a.perfil)}`.normalize("NFD").replace(/\p{M}/gu, "").toUpperCase();
  if (/ANEL\s+GUIA/.test(identidade)) return ["Contribui para centralizar haste ou êmbolo e orientar o movimento no cilindro.", "Ajuda a evitar contato entre superfícies metálicas quando corretamente selecionado e montado."];
  if (/GAXETA/.test(identidade)) {
    if (/\bBS\b/.test(identidade)) return ["Perfil BS destinado à vedação da haste na linha PK.", "Participa da contenção do fluido na passagem da haste pelo cabeçote, conforme o alojamento do conjunto."];
    if (/\bSTD\b/.test(identidade)) return ["Perfil STD destinado à vedação do êmbolo na linha PK.", "Participa da contenção do fluido entre êmbolo e camisa durante o movimento do cilindro."];
    if (/\bB\b/.test(identidade)) return ["Perfil B apresentado para vedação de êmbolo ou haste na linha PK.", "Permite selecionar a reposição pela posição de trabalho prevista no conjunto, conferindo canal, medidas e material."];
  }
  if (/RASPADOR/.test(identidade) && /\bD\b/.test(identidade)) return ["Perfil D destinado a retirar sujeira da haste em seu movimento de retorno.", "Ajuda a reduzir a entrada de contaminantes no conjunto de vedação; trabalha em conjunto com a gaxeta e a guia."];
  return [];
}
