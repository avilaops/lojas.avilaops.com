import indice from "@/content/domirio/indice.json";

export type ArtigoDomiRio = {
  title: string;
  slug: string;
  description: string;
  category: string;
  series: number;
  order: number;
  cover: string;
  coverAlt: string;
  sections: { title: string; id: string }[];
  readingMinutes: number;
};

const artigos: ArtigoDomiRio[] = [...indice].sort((a, b) => a.order - b.order);

export const temasDomiRio = [...new Map(artigos.map(p => [p.series, { id: p.series, nome: p.category, capa: p.cover }])).values()];

/** A coleção editorial pertence somente à Domi-Rio, nunca ao tenant que compartilha seu slug de post. */
export function artigosDomiRio(lojaSlug: string): ArtigoDomiRio[] {
  return lojaSlug === "domi-rio" ? artigos : [];
}

export function artigoDomiRio(lojaSlug: string, slug: string): ArtigoDomiRio | undefined {
  return artigosDomiRio(lojaSlug).find(p => p.slug === slug);
}

const normalizar = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");

export function filtrarArtigosDomiRio(itens: ArtigoDomiRio[], consulta = "", serie?: number): ArtigoDomiRio[] {
  const termos = normalizar(consulta).trim().split(/\s+/).filter(Boolean);
  return itens.filter(p => (serie === undefined || p.series === serie) && termos.every(t => normalizar(`${p.title} ${p.description} ${p.category}`).includes(t)));
}

export function navegacaoArtigoDomiRio(slug: string): { anterior?: ArtigoDomiRio; proximo?: ArtigoDomiRio; relacionados: ArtigoDomiRio[] } {
  const i = artigos.findIndex(p => p.slug === slug);
  if (i < 0) return { relacionados: [] };
  return {
    anterior: artigos[i - 1],
    proximo: artigos[i + 1],
    relacionados: artigos.filter(p => p.series === artigos[i].series && p.slug !== slug).slice(0, 3),
  };
}
