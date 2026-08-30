import { z } from "zod";
import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { avisarBuscadores } from "@/lib/indexnow";
import { gerarRascunhoSeoCategoria, publicarSeoCategoria } from "@/lib/seo-categorias";
import { emitir } from "@/lib/eventos";
import { urlDaLoja } from "@/lib/tenant";

const Entrada = z.object({ limite: z.number().int().min(1).max(25).default(10), tenantSlug: z.string().trim().max(80).optional() });
const LIMITE_TRAVA_MS = 15 * 60 * 1000;

/** Visibilidade da fila para o monitor do n8n e para operação. */
export async function GET(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  const agora = new Date();
  const travaExpirada = new Date(agora.getTime() - LIMITE_TRAVA_MS);
  const [pendentes, processando, comErro, maisAntiga] = await Promise.all([
    prisma.categoria.count({ where: { seoPendente: true } }),
    prisma.categoria.count({ where: { seoPendente: true, seoProcessandoEm: { gt: travaExpirada } } }),
    prisma.categoria.count({ where: { seoPendente: true, NOT: { seoErro: null } } }),
    prisma.categoria.findFirst({ where: { seoPendente: true }, orderBy: { atualizadoEm: "asc" }, select: { atualizadoEm: true } }),
  ]);
  return Response.json({ pendentes, processando, comErro, maisAntigaEm: maisAntiga?.atualizadoEm.toISOString() ?? null, verificadoEm: agora.toISOString() });
}

/**
 * Lote idempotente para o n8n. Só processa seoPendente=true; sucesso muda o
 * estado para false, então uma nova execução não gasta IA novamente.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  const entrada = Entrada.safeParse(await request.json().catch(() => ({})));
  if (!entrada.success) return Response.json({ erro: "Parâmetros inválidos." }, { status: 422 });

  const travaExpirada = new Date(Date.now() - LIMITE_TRAVA_MS);
  const categorias = await prisma.categoria.findMany({
    where: {
      seoPendente: true,
      OR: [{ seoProcessandoEm: null }, { seoProcessandoEm: { lt: travaExpirada } }],
      tenant: { status: "ATIVA", ...(entrada.data.tenantSlug ? { slug: entrada.data.tenantSlug } : {}) },
    },
    include: { tenant: true },
    orderBy: [{ atualizadoEm: "asc" }, { id: "asc" }],
    take: entrada.data.limite,
  });

  const processadas: Array<{ id: string; loja: string; categoria: string; origem: string }> = [];
  const falhas: Array<{ id: string; erro: string }> = [];
  const avisos = new Map<string, { tenant: (typeof categorias)[number]["tenant"]; caminhos: string[] }>();

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
  return Response.json({ encontradas: categorias.length, processadas, falhas });
}
