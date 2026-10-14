import type { Produto } from "@prisma/client";
import { SECOES_ATELIE, type TemaLoja } from "./tema";

/**
 * Ateliê: a home editorial de moda. O que muda entre lojas fica no tema
 * (`tema.atelie`); o componente só lê. Peça do look é produto do catálogo,
 * pelo slug. Campo de tecido, cor ou medida continua no campo personalizado
 * que a loja já declarou — aqui não nasce coluna.
 */

export const PALETA_ATELIE = {
  corPrimaria: "#7c4f3e",
  corPrimariaTexto: "#ffffff",
  corFundo: "#f6f1ea",
  corTexto: "#2a211c",
  modo: "claro",
  fonte: "dm-serif",
  raio: "reto",
} as const satisfies Pick<TemaLoja, "corPrimaria" | "corPrimariaTexto" | "corFundo" | "corTexto" | "modo" | "fonte" | "raio">;

export type SecaoAtelie = (typeof SECOES_ATELIE)[number];

export type LookResolvido<P extends { slug: string } = Produto> = {
  titulo: string;
  imagem: string;
  produtos: P[];
};

/** Ordem e presença das seções. Sem lista, entram todas. Lista vazia desliga todas. */
export function secoesDoAtelie(tema: Pick<TemaLoja, "atelie">): SecaoAtelie[] {
  const pedidas = tema.atelie?.secoes;
  if (!pedidas) return [...SECOES_ATELIE];
  const vistas = new Set<string>();
  const saida: SecaoAtelie[] = [];
  for (const secao of pedidas) {
    if (vistas.has(secao) || !SECOES_ATELIE.includes(secao)) continue;
    vistas.add(secao);
    saida.push(secao);
  }
  return saida;
}

/** Slugs citados pelos looks, sem repetir, na ordem em que aparecem. */
export function slugsDosLooks(tema: Pick<TemaLoja, "atelie">): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const look of tema.atelie?.looks ?? []) {
    for (const slug of look.produtos) {
      if (vistos.has(slug)) continue;
      vistos.add(slug);
      saida.push(slug);
    }
  }
  return saida;
}

/**
 * Look sem foto, ou com menos de duas peças que existem no catálogo, fica
 * de fora. A seção inteira some quando não sobra nenhum.
 */
export function resolverLooks<P extends { slug: string }>(tema: Pick<TemaLoja, "atelie">, produtos: P[]): LookResolvido<P>[] {
  const porSlug = new Map(produtos.map((produto) => [produto.slug, produto]));
  const saida: LookResolvido<P>[] = [];
  for (const look of tema.atelie?.looks ?? []) {
    if (!look.imagem) continue;
    const itens: P[] = [];
    const vistos = new Set<string>();
    for (const slug of look.produtos) {
      const produto = porSlug.get(slug);
      if (!produto || vistos.has(slug)) continue;
      vistos.add(slug);
      itens.push(produto);
    }
    if (itens.length < 2) continue;
    saida.push({ titulo: look.titulo, imagem: look.imagem, produtos: itens });
  }
  return saida;
}

export function textoDoSobre(tema: Pick<TemaLoja, "atelie">, sobre: string | null | undefined, diferencial: string | null | undefined): string {
  return tema.atelie?.sobre?.trim() || sobre?.trim() || diferencial?.trim() || "";
}
