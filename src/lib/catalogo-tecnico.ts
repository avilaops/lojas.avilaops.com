import type { Produto } from "@prisma/client";
import { descreverAnos, lerCompatibilidade } from "./motos";

/**
 * Catálogo técnico: a linha da tabela de peças do layout `catalogo-tecnico`.
 *
 * Quem compra peça chega com o código ou a medida na mão, e a foto vem depois.
 * Tudo aqui sai do que o produto já tem cadastrado (`sku`, `codigoOriginal`,
 * `codigosEquivalentes`, `compatibilidade`, peso e medidas); nada é por loja:
 * a coluna que nenhum produto preenche some (`colunasVisiveis`).
 *
 * Puro (sem React, sem Prisma em runtime), para ser testado sem banco.
 */

type Medidas = Pick<Produto, "comprimentoCm" | "larguraCm" | "alturaCm" | "pesoKg">;

export type ProdutoTecnico = Medidas &
  Pick<Produto, "slug" | "nome" | "marca" | "sku" | "codigoOriginal" | "codigosEquivalentes" | "compatibilidade">;

export interface Aplicacao {
  texto: string;
  /** Linhas de compatibilidade que não couberam em `texto`. */
  restantes: number;
  /** Linhas de compatibilidade cadastradas; zero é o produto universal. */
  total: number;
}

export interface LinhaTecnica {
  slug: string;
  nome: string;
  marca: string | null;
  codigo: string | null;
  codigoOriginal: string | null;
  equivalentes: string[];
  medidas: string | null;
  aplicacao: Aplicacao;
}

export const COLUNAS = ["codigo", "marca", "codigoOriginal", "equivalentes", "medidas", "aplicacao"] as const;
export type Coluna = (typeof COLUNAS)[number];

export const ROTULOS_COLUNA: Record<Coluna, string> = {
  codigo: "Código",
  marca: "Marca",
  codigoOriginal: "Código original",
  equivalentes: "Equivalentes",
  medidas: "Medidas",
  aplicacao: "Aplicação",
};

const numero = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
const medida = (n: number | null | undefined): n is number => typeof n === "number" && Number.isFinite(n) && n > 0;
const texto = (s: string | null | undefined) => s?.trim() || null;

/** `12 × 8 × 3 cm · 0,45 kg`; omite o que falta e devolve null sem nenhuma medida. */
export function medidasDe(p: Partial<Medidas>): string | null {
  const dimensoes = [p.comprimentoCm, p.larguraCm, p.alturaCm].filter(medida).map(numero);
  const partes = [
    ...(dimensoes.length ? [`${dimensoes.join(" × ")} cm`] : []),
    ...(medida(p.pesoKg) ? [`${numero(p.pesoKg)} kg`] : []),
  ];
  return partes.length ? partes.join(" · ") : null;
}

/**
 * Resumo da compatibilidade para uma célula: as primeiras `limite` aplicações
 * e quantas ficaram de fora. A lista completa está na página do produto.
 * Sem compatibilidade cadastrada o produto é universal, como em `encaixe`.
 */
export function aplicacaoDe(p: { compatibilidade?: unknown } | null | undefined, limite = 2): Aplicacao {
  const linhas = lerCompatibilidade(p?.compatibilidade);
  if (!linhas.length) return { texto: "Universal", restantes: 0, total: 0 };
  const quantas = Math.max(1, Math.floor(limite));
  const mostradas = linhas.slice(0, quantas).map((c) => {
    const temAno = c.anoDe != null || c.anoAte != null;
    return `${c.marca} ${c.modelo}${temAno ? ` (${descreverAnos(c)})` : ""}`;
  });
  return { texto: mostradas.join(", "), restantes: linhas.length - mostradas.length, total: linhas.length };
}

export function linhaTecnica(p: ProdutoTecnico): LinhaTecnica {
  return {
    slug: p.slug,
    nome: p.nome,
    marca: texto(p.marca),
    codigo: texto(p.sku),
    codigoOriginal: texto(p.codigoOriginal),
    equivalentes: (p.codigosEquivalentes ?? []).map((c) => c.trim()).filter(Boolean),
    medidas: medidasDe(p),
    aplicacao: aplicacaoDe(p),
  };
}

/**
 * "Universal" em toda linha não diz nada: a aplicação só conta quando é de
 * verdade. Quem decide é a quantidade de linhas, não o rótulo da célula.
 */
function preenchida(linha: LinhaTecnica, coluna: Coluna): boolean {
  if (coluna === "equivalentes") return linha.equivalentes.length > 0;
  if (coluna === "aplicacao") return linha.aplicacao.total > 0;
  return Boolean(linha[coluna]);
}

/** Colunas com valor em ao menos uma linha; a que ninguém preenche não aparece. */
export function colunasVisiveis(linhas: LinhaTecnica[]): Coluna[] {
  return COLUNAS.filter((coluna) => linhas.some((linha) => preenchida(linha, coluna)));
}
