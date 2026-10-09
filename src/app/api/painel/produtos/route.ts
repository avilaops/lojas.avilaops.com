import { z } from "zod";
import { prisma } from "@/lib/db";
import { ProdutoEntradaSchema, ProdutoPlanilhaSchema, conferirImagem } from "@/lib/admin-schemas";
import { importarProdutos } from "@/lib/admin-tenants";
import { lojistaAtual } from "@/lib/sessao";
import { exigir } from "@/lib/operadores";
import { avisarERegistrar, caminhosDoProduto } from "@/lib/indexnow";
import { slugificar } from "@/lib/catalogo";
import type { Prisma } from "@prisma/client";
import { invalidarCatalogo } from "@/lib/catalogo-cache";
import { salvarProdutoNoCatalogo, respostaErroCatalogo } from "@/lib/catalogo-escrita";
import { origemDoPainel } from "@/lib/catalogo-origem";
import { ErroCampo, lerDefinicoes, normalizarValores } from "@/lib/campos-personalizados";

/** PUT — importa/atualiza em lote (CSV ou um único produto do formulário). */
export async function PUT(request: Request) {
  const { s, erro } = await exigir("catalogo");
  if (erro) return erro;
  const loja = s.tenant;
  const r = z.array(ProdutoPlanilhaSchema).min(1).max(2000).safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Dados inválidos.", detalhes: r.error.flatten() }, { status: 422 });
  let resultado;
  try { resultado = await importarProdutos(loja.id, r.data); } catch (e) { return respostaErroCatalogo(e); }
  // Indexação garantida: produto novo ou alterado é avisado aos buscadores.
  const recentes = await prisma.produto.findMany({ where: { tenantId: loja.id, ativo: true }, include: { categoria: true }, orderBy: { atualizadoEm: "desc" }, take: 50 });
  void avisarERegistrar(loja, recentes.flatMap((p) => caminhosDoProduto(p.slug, p.categoria?.slug)));
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
  await salvarProdutoNoCatalogo(loja.id, id, { ativo: false }, { origem: origemDoPainel(s) });
  invalidarCatalogo(loja.id);
  return Response.json({ ok: true });
}

/** GET ?id= — produto completo para o formulário de edição. */
export async function GET(request: Request) {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const p = await prisma.produto.findFirst({ where: { id, tenantId: loja.id }, include: { categoria: true, midias: { where: { varianteId: null, tipo: "imagem" }, orderBy: { ordem: "asc" } }, variantes: { where: { padrao:true,ativo:true },include:{saldos:true} } } });
  if (!p) return Response.json({ erro: "Produto não encontrado." }, { status: 404 });
  const simples=p.variantes[0];
  // As definições de campo vêm junto do produto para o formulário não precisar
  // de uma segunda chamada só para saber que perguntas fazer.
  return Response.json({ ...p, estoque:simples?.saldos.find(s=>s.local==="principal")?.fisico ?? p.estoque, mpn:simples?.mpn??null, identificadoresEstado:simples?.identificadoresEstado??"desconhecido", categoria: p.categoria?.nome ?? null, definicoesCampos: lerDefinicoes(loja.camposPersonalizados) });
}

const Edicao = conferirImagem(ProdutoEntradaSchema.partial().extend({ id: z.string(), versaoCatalogo: z.number().int().positive().optional(), confirmarImagemExata: z.boolean().optional(), correspondenciaImagem: z.enum(["nao_confirmada", "confirmada", "rejeitada"]).optional(), associarFotoSku: z.boolean().optional() }));

/** PATCH — edita um produto (qualquer campo; categoria por nome, criada se não existir). */
export async function PATCH(request: Request) {
  const { s, erro } = await exigir("catalogo");
  if (erro) return erro;
  const loja = s.tenant;
  const r = Edicao.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Dados inválidos.", detalhes: r.error.flatten() }, { status: 422 });
  const { id, categoria, atributos, slug, compatibilidade, versaoCatalogo, camposPersonalizados, confirmarImagemExata, correspondenciaImagem, associarFotoSku, ...campos } = r.data;
  const p = await prisma.produto.findFirst({ where: { id, tenantId: loja.id } });
  if (!p) return Response.json({ erro: "Produto não encontrado." }, { status: 404 });
  if (associarFotoSku) {
    const dominio = process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com";
    const prefixoImagem = `https://${dominio}/uploads/${loja.slug}/`;
    if (p.imagens.length || !p.sku || campos.sku !== p.sku || campos.imagemOrigem !== "propria" || !confirmarImagemExata || campos.imagens?.length !== 1 || !campos.imagens[0].startsWith(prefixoImagem)) {
      return Response.json({ erro: "Não foi possível confirmar uma única foto enviada para o SKU sem imagem." }, { status: 409 });
    }
  }

  let categoriaId: string | null | undefined = undefined;
  if (categoria !== undefined) {
    if (!categoria) categoriaId = null;
    else {
      const cslug = slugificar(categoria);
      const c = await prisma.categoria.upsert({ where: { tenantId_slug: { tenantId: loja.id, slug: cslug } }, update: {}, create: { tenantId: loja.id, slug: cslug, nome: categoria } });
      categoriaId = c.id;
    }
  }
  // Os valores dos campos personalizados passam pelas definições da loja: é
  // ali que "12,5" vira número, que a lista de opções é conferida e que um
  // `javascript:` colado num campo de link é recusado. Campo que a loja apagou
  // não fica pendurado no produto.
  let valoresCampos: Record<string, string> | undefined;
  if (camposPersonalizados) {
    try {
      valoresCampos = normalizarValores(lerDefinicoes(loja.camposPersonalizados), camposPersonalizados);
    } catch (e) {
      return Response.json({ erro: e instanceof ErroCampo ? e.message : "Campo personalizado inválido." }, { status: 422 });
    }
  }

  let atualizado;
  if (confirmarImagemExata && ((campos.imagemOrigem ?? p.imagemOrigem) !== "propria" || !((campos.imagens?.length ?? 0) || p.imagens.length))) return Response.json({ erro: "Confirme somente uma foto principal própria que esteja associada ao produto." }, { status: 422 });
  const correspondenciaFinal = confirmarImagemExata ? "confirmada" : correspondenciaImagem;
  if (correspondenciaFinal && ((campos.imagemOrigem ?? p.imagemOrigem) !== "propria" || !((campos.imagens?.length ?? 0) || p.imagens.length))) return Response.json({ erro: "A correspondência da imagem exige foto principal própria associada ao produto." }, { status: 422 });
  try { atualizado = await salvarProdutoNoCatalogo(loja.id, id, { ...campos, ...(valoresCampos ? { camposPersonalizados: valoresCampos as unknown as Prisma.InputJsonValue } : {}), ...(slug ? { slug: slugificar(slug) } : {}), ...(categoriaId !== undefined ? { categoriaId } : {}), ...(atributos ? { atributos: atributos as Prisma.InputJsonValue } : {}), ...(compatibilidade ? { compatibilidade: compatibilidade as unknown as Prisma.InputJsonValue } : {}) }, { origem: origemDoPainel(s), versao: versaoCatalogo, exigirSemImagem: associarFotoSku, ...(correspondenciaFinal ? { metadadosMidia: { fonte: "painel", correspondencia: correspondenciaFinal, somentePrincipal: true } } : {}) });
  } catch(e) { return respostaErroCatalogo(e); }
  invalidarCatalogo(loja.id);
  void avisarERegistrar(loja, caminhosDoProduto(atualizado.slug, categoria ?? undefined));
  return Response.json({ id: atualizado.id, slug: atualizado.slug, versaoCatalogo: atualizado.versaoCatalogo });
}
