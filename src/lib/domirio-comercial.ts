import { compravel } from "./produto-regras";

type CandidatoVitrine = Parameters<typeof compravel>[0] & { id: string; categoriaId: string | null; imagens: string[]; atributos: unknown };

/** Primeiro uma família por categoria; depois outras famílias, antes de repetir volumes. */
export function selecionarVitrineDomiRio<T extends CandidatoVitrine>(produtos: T[], limite = 12): T[] {
  const prontos = produtos.filter(p => compravel(p) && p.imagens.length > 0);
  const selecionados: T[] = [];
  const ids = new Set<string>();
  const categorias = new Set<string | null>();
  const familias = new Set<string>();
  const familia = (p: T) => {
    const a = p.atributos as Record<string, unknown> | null;
    return typeof a?.familia === "string" && a.familia.trim() ? a.familia.trim().toLocaleLowerCase("pt-BR") : p.id;
  };
  for (const etapa of [0, 1, 2]) {
    for (const p of prontos) {
      if (selecionados.length >= limite) return selecionados;
      if (ids.has(p.id) || (etapa < 2 && familias.has(familia(p))) || (etapa === 0 && categorias.has(p.categoriaId))) continue;
      selecionados.push(p);
      ids.add(p.id); categorias.add(p.categoriaId); familias.add(familia(p));
    }
  }
  return selecionados;
}

export type ProdutoCotacaoDomiRio = { nome: string; slug: string; sku: string | null; apresentacao?: string; varianteId?: string };

export function mensagemCotacaoDomiRio(produto: ProdutoCotacaoDomiRio, base: string, quantidade: number) {
  if (!Number.isSafeInteger(quantidade) || quantidade < 1 || quantidade > 99999) throw new Error("Informe uma quantidade inteira entre 1 e 99999.");
  const url = new URL(`/produtos/${encodeURIComponent(produto.slug)}`, base);
  if (produto.varianteId) url.searchParams.set("variante", produto.varianteId);
  return ["Olá, Domi-Rio! Gostaria de uma cotação:", produto.nome,
    produto.sku ? `Código: ${produto.sku}` : null,
    produto.apresentacao ? `Apresentação: ${produto.apresentacao}` : null,
    `Quantidade: ${quantidade} ${quantidade === 1 ? "unidade" : "unidades"}`,
    url.href,
    "Podem confirmar disponibilidade, condições de pagamento e frete para meu CEP?",
  ].filter(Boolean).join("\n");
}

/** A fonte privada só vira link público quando é o endereço verificado do fabricante. */
export function fonteOficialDomiRio(atributos: unknown): string | null {
  const a = atributos as Record<string, unknown> | null;
  if (typeof a?._fonteTecnicaVerificada !== "string") return null;
  try {
    const url = new URL(a._fonteTecnicaVerificada);
    return url.protocol === "https:" && ["isorgan.com.br", "www.isorgan.com.br"].includes(url.hostname) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

/** Links de pesquisa, sem afirmar indicação agrícola dos produtos da loja. */
export function categoriasDoArtigoDomiRio(serie: number): string[] {
  if (serie === 2) return ["controle-de-pragas", "inseticida"];
  if (serie === 3) return ["herbicidas"];
  return [];
}
