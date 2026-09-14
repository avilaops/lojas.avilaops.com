import { z } from "zod";
import { prisma } from "@/lib/db";
import { ProdutoEntradaSchema, conferirImagem } from "@/lib/admin-schemas";
import { importarProdutos } from "@/lib/admin-tenants";
import { lojistaAtual } from "@/lib/sessao";
import { exigir } from "@/lib/operadores";
import { avisarBuscadores, caminhosDoProduto } from "@/lib/indexnow";
import { slugificar } from "@/lib/catalogo";
import type { Prisma } from "@prisma/client";
import { invalidarCatalogo } from "@/lib/catalogo-cache";
import { salvarProdutoNoCatalogo, respostaErroCatalogo } from "@/lib/catalogo-escrita";

/** PUT — importa/atualiza em lote (CSV ou um único produto do formulário). */
export async function PUT(request: Request) {
  const { s, erro } = await exigir("catalogo");
  if (erro) return erro;
  const loja = s.tenant;
  const r = z.array(ProdutoEntradaSchema).min(1).max(2000).safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Dados inválidos.", detalhes: r.error.flatten() }, { status: 422 });
  let resultado;
  try { resultado = await importarProdutos(loja.id, r.data); } catch (e) { return respostaErroCatalogo(e); }
  // Indexação garantida: produto novo ou alterado é avisado aos buscadores.
  const recentes = await prisma.produto.findMany({ where: { tenantId: loja.id, ativo: true }, include: { categoria: true }, orderBy: { atualizadoEm: "desc" }, take: 50 });
  void avisarBuscadores(loja, recentes.flatMap((p) => caminhosDoProduto(p.slug, p.categoria?.slug)));
  return Response.json(resultado);
}

/** DELETE ?id= — desativa (não apaga: pedidos antigos apontam para ele). */
export async function DELETE(request: Request) {
  const { s, erro } = await exigir("catalogo");
  if (erro) return erro;
  const loja = s.tenant;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const p = await prisma.produto.findFirst({ where: { id, tenantId: loja.id } });
  if (!p) return Response.json({ erro: "Produto não encontrado." }, { status: 404 });
  await salvarProdutoNoCatalogo(loja.id, id, { ativo: false }, { origem: "painel" });
  invalidarCatalogo(loja.id);
  return Response.json({ ok: true });
}

/** GET ?id= — produto completo para o formulário de edição. */
export async function GET(request: Request) {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const p = await prisma.produto.findFirst({ where: { id, tenantId: loja.id }, include: { categoria: true, variantes: { where: { padrao:true,ativo:true },include:{saldos:true} } } });
  if (!p) return Response.json({ erro: "Produto não encontrado." }, { status: 404 });
  const simples=p.variantes[0];
  return Response.json({ ...p, estoque:simples?.saldos.find(s=>s.local==="principal")?.fisico ?? p.estoque, mpn:simples?.mpn??null, identificadoresEstado:simples?.identificadoresEstado??"desconhecido", categoria: p.categoria?.nome ?? null });
}

const Edicao = conferirImagem(ProdutoEntradaSchema.partial().extend({ id: z.string(), versaoCatalogo: z.number().int().positive().optional() }));

/** PATCH — edita um produto (qualquer campo; categoria por nome, criada se não existir). */
export async function PATCH(request: Request) {
  const { s, erro } = await exigir("catalogo");
  if (erro) return erro;
  const loja = s.tenant;
  const r = Edicao.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Dados inválidos.", detalhes: r.error.flatten() }, { status: 422 });
  const { id, categoria, atributos, slug, compatibilidade, versaoCatalogo, ...campos } = r.data;
  const p = await prisma.produto.findFirst({ where: { id, tenantId: loja.id } });
  if (!p) return Response.json({ erro: "Produto não encontrado." }, { status: 404 });

  let categoriaId: string | null | undefined = undefined;
  if (categoria !== undefined) {
    if (!categoria) categoriaId = null;
    else {
      const cslug = slugificar(categoria);
      const c = await prisma.categoria.upsert({ where: { tenantId_slug: { tenantId: loja.id, slug: cslug } }, update: {}, create: { tenantId: loja.id, slug: cslug, nome: categoria } });
      categoriaId = c.id;
    }
  }
  let atualizado;
  try { atualizado = await salvarProdutoNoCatalogo(loja.id, id, { ...campos, ...(slug ? { slug: slugificar(slug) } : {}), ...(categoriaId !== undefined ? { categoriaId } : {}), ...(atributos ? { atributos: atributos as Prisma.InputJsonValue } : {}), ...(compatibilidade ? { compatibilidade: compatibilidade as unknown as Prisma.InputJsonValue } : {}) }, { origem: "painel", versao: versaoCatalogo });
  } catch(e) { return respostaErroCatalogo(e); }
  invalidarCatalogo(loja.id);
  void avisarBuscadores(loja, caminhosDoProduto(atualizado.slug, categoria ?? undefined));
  return Response.json({ id: atualizado.id, slug: atualizado.slug, versaoCatalogo: atualizado.versaoCatalogo });
}
