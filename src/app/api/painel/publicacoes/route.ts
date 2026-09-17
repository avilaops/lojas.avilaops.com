import { z } from "zod";
import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";
import { avisarBuscadores } from "@/lib/indexnow";
import { slugLivre } from "@/lib/publicacoes";

/**
 * As publicações do blog da loja.
 *
 * GET lista (painel: rascunho junto), POST cria, PATCH edita, DELETE apaga.
 * Toda consulta filtra por `tenantId` da sessão — nunca pelo id que veio no
 * corpo —, que é o que impede uma loja editar o post da outra chutando um id.
 */

const Entrada = z.object({
  titulo: z.string().trim().min(3).max(160),
  resumo: z.string().trim().max(300).nullable().optional(),
  corpo: z.string().max(40_000),
  capaUrl: z.string().url().nullable().optional(),
  autor: z.string().trim().max(80).nullable().optional(),
  estado: z.enum(["rascunho", "publicada"]).optional(),
  /** ISO. Permite agendar; vazio na publicação = agora. */
  publicadoEm: z.string().datetime().nullable().optional(),
  slug: z.string().trim().max(80).optional(),
  seoTitle: z.string().trim().max(70).nullable().optional(),
  seoDescription: z.string().trim().max(180).nullable().optional(),
});

export async function GET() {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const publicacoes = await prisma.publicacaoLoja.findMany({
    where: { tenantId: s.tenant.id },
    // Rascunho primeiro pela edição mais recente, publicada pela data de
    // publicação: é a ordem em que o lojista procura o que estava fazendo.
    orderBy: [{ estado: "asc" }, { publicadoEm: "desc" }, { atualizadoEm: "desc" }],
    take: 200,
  });
  return Response.json({ publicacoes });
}

export async function POST(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Dados inválidos.", detalhes: r.error.flatten() }, { status: 422 });

  const dados = r.data;
  const estado = dados.estado ?? "rascunho";
  const publicacao = await prisma.publicacaoLoja.create({
    data: {
      tenantId: s.tenant.id,
      slug: await slugLivre(s.tenant.id, dados.slug || dados.titulo),
      titulo: dados.titulo,
      resumo: dados.resumo ?? null,
      corpo: dados.corpo,
      capaUrl: dados.capaUrl ?? null,
      autor: dados.autor ?? null,
      estado,
      publicadoEm: quandoPublicar(estado, dados.publicadoEm, null),
      seoTitle: dados.seoTitle ?? null,
      seoDescription: dados.seoDescription ?? null,
    },
  });
  if (estado === "publicada") void avisarBuscadores(s.tenant, ["/blog", `/blog/${publicacao.slug}`]);
  return Response.json({ publicacao }, { status: 201 });
}

export async function PATCH(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const r = Entrada.partial().extend({ id: z.string() }).safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Dados inválidos.", detalhes: r.error.flatten() }, { status: 422 });

  const { id, ...dados } = r.data;
  const atual = await prisma.publicacaoLoja.findFirst({ where: { id, tenantId: s.tenant.id } });
  if (!atual) return Response.json({ erro: "Publicação não encontrada." }, { status: 404 });

  const estado = dados.estado ?? (atual.estado as "rascunho" | "publicada");
  // Slug só muda quando o lojista pede: mudar sozinho ao renomear o título
  // quebraria o link que já está no WhatsApp de quem leu.
  const slug = dados.slug && dados.slug !== atual.slug ? await slugLivre(s.tenant.id, dados.slug, atual.id) : atual.slug;

  const publicacao = await prisma.publicacaoLoja.update({
    where: { id: atual.id },
    data: {
      slug,
      ...(dados.titulo !== undefined ? { titulo: dados.titulo } : {}),
      ...(dados.resumo !== undefined ? { resumo: dados.resumo } : {}),
      ...(dados.corpo !== undefined ? { corpo: dados.corpo } : {}),
      ...(dados.capaUrl !== undefined ? { capaUrl: dados.capaUrl } : {}),
      ...(dados.autor !== undefined ? { autor: dados.autor } : {}),
      ...(dados.seoTitle !== undefined ? { seoTitle: dados.seoTitle } : {}),
      ...(dados.seoDescription !== undefined ? { seoDescription: dados.seoDescription } : {}),
      estado,
      publicadoEm: quandoPublicar(estado, dados.publicadoEm, atual.publicadoEm),
    },
  });
  if (estado === "publicada") void avisarBuscadores(s.tenant, ["/blog", `/blog/${publicacao.slug}`]);
  return Response.json({ publicacao });
}

export async function DELETE(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const { count } = await prisma.publicacaoLoja.deleteMany({ where: { id, tenantId: s.tenant.id } });
  if (!count) return Response.json({ erro: "Publicação não encontrada." }, { status: 404 });
  return Response.json({ apagado: true });
}

/**
 * Quando este texto vai ao ar.
 *
 * Voltar para rascunho zera a data de propósito: senão, republicar depois
 * traria de volta a data antiga, e o post reapareceria no meio da lista em vez
 * de no topo. A data existente é preservada numa edição de post já publicado —
 * corrigir um typo não é republicar.
 */
function quandoPublicar(estado: string, pedida: string | null | undefined, atual: Date | null): Date | null {
  if (estado !== "publicada") return null;
  if (pedida) return new Date(pedida);
  return atual ?? new Date();
}
