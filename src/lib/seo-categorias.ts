import type { Categoria, Tenant } from "@prisma/client";
import { prisma } from "./db";
import { gerarSeoCategoria, SeoCategoriaGeradaSchema, type SeoCategoriaGerada } from "./genai";
import { lerCompatibilidade } from "./motos";
import { emitir } from "./eventos";
import { avisarBuscadores } from "./indexnow";
import { urlDaLoja } from "./tenant";

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

// --- Lote ------------------------------------------------------------------

/** Quanto tempo uma categoria fica reivindicada antes de voltar para a fila. */
export const LIMITE_TRAVA_SEO_MS = 15 * 60 * 1000;

export interface ResumoSeoCategorias {
  encontradas: number;
  processadas: Array<{ id: string; loja: string; categoria: string; origem: OrigemSeoCategoria }>;
  falhas: Array<{ id: string; erro: string }>;
}

export interface FilaSeoCategorias {
  pendentes: number;
  processando: number;
  comErro: number;
  maisAntigaEm: string | null;
  verificadoEm: string;
}

/** O estado da fila sem gastar IA — é o que a tela de operação lê. */
export async function filaSeoCategorias(agora = new Date()): Promise<FilaSeoCategorias> {
  const travaExpirada = new Date(agora.getTime() - LIMITE_TRAVA_SEO_MS);
  const [pendentes, processando, comErro, maisAntiga] = await Promise.all([
    prisma.categoria.count({ where: { seoPendente: true } }),
    prisma.categoria.count({ where: { seoPendente: true, seoProcessandoEm: { gt: travaExpirada } } }),
    prisma.categoria.count({ where: { seoPendente: true, NOT: { seoErro: null } } }),
    prisma.categoria.findFirst({ where: { seoPendente: true }, orderBy: { atualizadoEm: "asc" }, select: { atualizadoEm: true } }),
  ]);
  return {
    pendentes,
    processando,
    comErro,
    maisAntigaEm: maisAntiga?.atualizadoEm.toISOString() ?? null,
    verificadoEm: agora.toISOString(),
  };
}

/**
 * Processa o lote de categorias com SEO pendente.
 *
 * Idempotente: só olha `seoPendente = true` e o sucesso vira `false`, então
 * rodar de novo não gasta IA de novo. Cada categoria é reivindicada com uma
 * trava de 15 min antes do efeito, e execuções concorrentes não pegam a mesma.
 *
 * Vivia dentro da rota `/api/admin/seo/categorias`; saiu de lá quando o
 * agendador interno passou a precisar do mesmo trabalho sem passar por HTTP.
 */
export async function processarSeoCategoriasPendentes(
  opcoes: { limite?: number; tenantSlug?: string } = {},
): Promise<ResumoSeoCategorias> {
  const limite = opcoes.limite ?? 10;
  const travaExpirada = new Date(Date.now() - LIMITE_TRAVA_SEO_MS);
  const categorias = await prisma.categoria.findMany({
    where: {
      seoPendente: true,
      OR: [{ seoProcessandoEm: null }, { seoProcessandoEm: { lt: travaExpirada } }],
      tenant: { status: "ATIVA", ...(opcoes.tenantSlug ? { slug: opcoes.tenantSlug } : {}) },
    },
    include: { tenant: true },
    orderBy: [{ atualizadoEm: "asc" }, { id: "asc" }],
    take: limite,
  });

  const processadas: ResumoSeoCategorias["processadas"] = [];
  const falhas: ResumoSeoCategorias["falhas"] = [];
  const avisos = new Map<string, { tenant: Tenant; caminhos: string[] }>();

  for (const categoria of categorias) {
    const processandoEm = new Date();
    try {
      const reivindicada = await prisma.categoria.updateMany({
        where: {
          id: categoria.id,
          seoPendente: true,
          OR: [{ seoProcessandoEm: null }, { seoProcessandoEm: { lt: travaExpirada } }],
        },
        data: { seoProcessandoEm: processandoEm, seoErro: null },
      });
      if (!reivindicada.count) continue;
      const gerado = await gerarRascunhoSeoCategoria(categoria.tenant, categoria.id);
      if (!gerado) throw new Error("categoria não encontrada");
      const publicada = await publicarSeoCategoria(categoria.tenantId, categoria.id, gerado.rascunho, { processandoEm });
      if (!publicada) throw new Error("categoria alterada durante o processamento; rascunho descartado");
      processadas.push({ id: categoria.id, loja: categoria.tenant.slug, categoria: categoria.nome, origem: gerado.rascunho.origem });
      void emitir({
        tipo: "categoria.seo-publicado",
        slug: categoria.tenant.slug,
        nome: categoria.tenant.nome,
        categoriaId: categoria.id,
        categoriaSlug: categoria.slug,
        categoriaNome: categoria.nome,
        url: `${urlDaLoja(categoria.tenant)}/categoria/${categoria.slug}`,
        origem: gerado.rascunho.origem,
      });
      const atual = avisos.get(categoria.tenantId) ?? { tenant: categoria.tenant, caminhos: [] };
      atual.caminhos.push(`/categoria/${categoria.slug}`);
      avisos.set(categoria.tenantId, atual);
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : "falha inesperada";
      falhas.push({ id: categoria.id, erro: mensagem });
      await prisma.categoria.updateMany({
        where: { id: categoria.id, seoProcessandoEm: processandoEm },
        data: { seoProcessandoEm: null, seoErro: mensagem.slice(0, 500), seoPendente: true },
      });
    }
  }
  for (const { tenant, caminhos } of avisos.values()) void avisarBuscadores(tenant, [...caminhos, "/sitemap.xml"]);
  return { encontradas: categorias.length, processadas, falhas };
}
