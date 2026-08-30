import type { Categoria, Tenant } from "@prisma/client";
import { prisma } from "./db";
import { gerarSeoCategoria, SeoCategoriaGeradaSchema, type SeoCategoriaGerada } from "./genai";
import { lerCompatibilidade } from "./motos";

export type OrigemSeoCategoria = "manual" | "gemini" | "fallback";

export interface RascunhoSeoCategoria {
  dados: SeoCategoriaGerada;
  origem: OrigemSeoCategoria;
  modelo: string | null;
}

function unicos(valores: string[], limite: number): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const valor of valores.map((v) => v.trim()).filter(Boolean)) {
    const chave = valor.toLocaleLowerCase("pt-BR");
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(valor);
    if (saida.length === limite) break;
  }
  return saida;
}

function termosValidos(valores: string[], limite: number): string[] {
  return unicos(valores.filter((valor) => valor.trim().length >= 2), limite);
}

function limitar(texto: string, maximo: number): string {
  const limpo = texto.replace(/\s+/g, " ").trim();
  if (limpo.length <= maximo) return limpo;
  return `${limpo.slice(0, maximo - 1).replace(/\s+\S*$/, "")}…`;
}

/** Fallback determinístico e testável, sempre baseado nos dados reais. */
export function seoCategoriaFallback(entrada: {
  loja: string;
  segmento: string;
  categoria: string;
  descricaoAtual?: string | null;
  marcas: string[];
  motos: string[];
}): SeoCategoriaGerada {
  const contexto = entrada.segmento === "motopecas"
    ? entrada.motos.length
      ? ` para ${entrada.motos.slice(0, 3).join(", ")}`
      : " para motos"
    : "";
  const marcas = entrada.marcas.length ? ` de marcas como ${entrada.marcas.slice(0, 3).join(", ")}` : "";
  const descricaoAtual = entrada.descricaoAtual?.trim() ?? "";
  const descricaoBase = descricaoAtual.length >= 40
    ? descricaoAtual
    : `${descricaoAtual ? `${descricaoAtual}. ` : ""}Encontre produtos da categoria ${entrada.categoria}${contexto}${marcas} no catálogo da ${entrada.loja}.`;
  const descricao = limitar(descricaoBase, 170);
  const palavrasChave = termosValidos([
    entrada.categoria,
    ...entrada.marcas,
    ...entrada.motos,
    ...(entrada.segmento === "motopecas" ? ["peças para moto", "motopeças"] : []),
  ], 10);
  const titulo = entrada.categoria.trim().length >= 3 ? entrada.categoria : `Categoria ${entrada.categoria}`;
  return SeoCategoriaGeradaSchema.parse({ titulo: limitar(titulo, 70), descricao, palavrasChave });
}

export async function gerarRascunhoSeoCategoria(
  tenant: Tenant,
  categoriaId: string,
  contexto?: string,
): Promise<{ categoria: Categoria; rascunho: RascunhoSeoCategoria } | null> {
  const categoria = await prisma.categoria.findFirst({ where: { id: categoriaId, tenantId: tenant.id } });
  if (!categoria) return null;

  const produtos = await prisma.produto.findMany({
    where: { tenantId: tenant.id, categoriaId, ativo: true },
    select: { nome: true, marca: true, compatibilidade: true },
    orderBy: [{ destaque: "desc" }, { nome: "asc" }],
    take: 60,
  });
  const marcas = unicos(produtos.map((p) => p.marca ?? ""), 12);
  const motos = unicos(produtos.flatMap((p) => lerCompatibilidade(p.compatibilidade).map((m) => `${m.marca} ${m.modelo}`)), 16);
  const entrada = {
    loja: tenant.nome,
    segmento: tenant.segmento,
    categoria: categoria.nome,
    descricaoAtual: categoria.descricao,
    produtos: produtos.map((p) => p.nome).slice(0, 30),
    marcas,
    motos,
    contexto,
  };

  const ia = await gerarSeoCategoria(entrada);
  if (ia) return { categoria, rascunho: { dados: ia.dados, origem: "gemini", modelo: ia.modelo } };
  return { categoria, rascunho: { dados: seoCategoriaFallback(entrada), origem: "fallback", modelo: null } };
}

export async function publicarSeoCategoria(
  tenantId: string,
  categoriaId: string,
  rascunho: RascunhoSeoCategoria,
  opcoes?: { processandoEm?: Date },
): Promise<Categoria | null> {
  const categoria = await prisma.categoria.findFirst({ where: { id: categoriaId, tenantId } });
  if (!categoria) return null;
  const dados = SeoCategoriaGeradaSchema.parse(rascunho.dados);
  const data = {
    seoTitle: dados.titulo,
    seoDescription: dados.descricao,
    seoKeywords: termosValidos(dados.palavrasChave, 10),
    seoOrigem: rascunho.origem,
    seoModelo: rascunho.modelo,
    seoPendente: false,
    seoAtualizadoEm: new Date(),
    seoProcessandoEm: null,
    seoErro: null,
  };
  if (!opcoes?.processandoEm) return prisma.categoria.update({ where: { id: categoria.id }, data });
  const publicada = await prisma.categoria.updateMany({
    where: { id: categoria.id, tenantId, seoProcessandoEm: opcoes.processandoEm },
    data,
  });
  return publicada.count ? prisma.categoria.findUnique({ where: { id: categoria.id } }) : null;
}
