import { z } from "zod";
import { prisma } from "@/lib/db";
import { lojistaAtual } from "@/lib/sessao";
import { exigir } from "@/lib/operadores";
import { slugificar } from "@/lib/catalogo";
import { emitir } from "@/lib/eventos";
import { avisarBuscadores } from "@/lib/indexnow";
import { urlDaLoja } from "@/lib/tenant";

const Entrada = z.object({
  id: z.string().optional(),
  nome: z.string().trim().min(1).max(80),
  descricao: z.string().trim().max(300).nullable().optional(),
  imagemUrl: z.string().url().nullable().optional(),
  ordem: z.number().int().min(0).max(999).optional(),
});

export async function GET() {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  return Response.json(await prisma.categoria.findMany({ where: { tenantId: loja.id }, orderBy: [{ ordem: "asc" }, { nome: "asc" }], include: { _count: { select: { produtos: true } } } }));
}

/** POST — cria ou atualiza (com id). */
export async function POST(request: Request) {
  const { s, erro } = await exigir("catalogo");
  if (erro) return erro;
  const loja = s.tenant;
  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Dados inválidos." }, { status: 422 });
  const { id, ...dados } = r.data;
  if (id) {
    const c = await prisma.categoria.findFirst({ where: { id, tenantId: loja.id } });
    if (!c) return Response.json({ erro: "Categoria não encontrada." }, { status: 404 });
    const conteudoMudou = dados.nome !== c.nome || (dados.descricao !== undefined && (dados.descricao ?? null) !== c.descricao);
    const categoria = await prisma.categoria.update({
      where: { id },
      data: { ...dados, ...(conteudoMudou ? { seoPendente: true, seoProcessandoEm: null, seoErro: null } : {}) },
    });
    if (conteudoMudou) {
      void emitir({
        tipo: "categoria.seo-pendente",
        slug: loja.slug,
        nome: loja.nome,
        categoriaId: categoria.id,
        categoriaSlug: categoria.slug,
        categoriaNome: categoria.nome,
        url: `${urlDaLoja(loja)}/categoria/${categoria.slug}`,
      });
    }
    void avisarBuscadores(loja, ["/", "/produtos", `/categoria/${categoria.slug}`, "/sitemap.xml"]);
    return Response.json(categoria);
  }
  const slug = slugificar(dados.nome);
  if (!slug) return Response.json({ erro: "O nome precisa conter letras ou números." }, { status: 422 });
  const existente = await prisma.categoria.findUnique({ where: { tenantId_slug: { tenantId: loja.id, slug } } });
  if (existente) {
    const conteudoMudou = dados.nome !== existente.nome || (dados.descricao !== undefined && (dados.descricao ?? null) !== existente.descricao);
    const categoria = await prisma.categoria.update({
      where: { id: existente.id },
      data: { ...dados, ...(conteudoMudou ? { seoPendente: true, seoProcessandoEm: null, seoErro: null } : {}) },
    });
    if (conteudoMudou) {
      void emitir({
        tipo: "categoria.seo-pendente",
        slug: loja.slug,
        nome: loja.nome,
        categoriaId: categoria.id,
        categoriaSlug: categoria.slug,
        categoriaNome: categoria.nome,
        url: `${urlDaLoja(loja)}/categoria/${categoria.slug}`,
      });
    }
    void avisarBuscadores(loja, ["/", "/produtos", `/categoria/${categoria.slug}`, "/sitemap.xml"]);
    return Response.json(categoria);
  }
  const total = await prisma.categoria.count({ where: { tenantId: loja.id } });
  const categoria = await prisma.categoria.create({ data: { ...dados, tenantId: loja.id, slug, ordem: dados.ordem ?? total } });
  void emitir({
    tipo: "categoria.seo-pendente",
    slug: loja.slug,
    nome: loja.nome,
    categoriaId: categoria.id,
    categoriaSlug: categoria.slug,
    categoriaNome: categoria.nome,
    url: `${urlDaLoja(loja)}/categoria/${categoria.slug}`,
  });
  void avisarBuscadores(loja, ["/", "/produtos", `/categoria/${categoria.slug}`, "/sitemap.xml"]);
  return Response.json(categoria);
}

/** DELETE ?id= — apaga; produtos ficam sem categoria. */
export async function DELETE(request: Request) {
  const { s, erro } = await exigir("catalogo");
  if (erro) return erro;
  const loja = s.tenant;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const c = await prisma.categoria.findFirst({ where: { id, tenantId: loja.id } });
  if (!c) return Response.json({ erro: "Categoria não encontrada." }, { status: 404 });
  await prisma.categoria.delete({ where: { id } });
  void avisarBuscadores(loja, ["/", "/produtos", `/categoria/${c.slug}`, "/sitemap.xml"]);
  return Response.json({ ok: true });
}
