import { z } from "zod";
import { prisma } from "@/lib/db";
import { lojistaAtual } from "@/lib/sessao";

/**
 * Variações de um produto. PUT substitui o conjunto inteiro (opções + lista):
 * é como o painel trabalha — o lojista edita a grade e salva. Variações que
 * sumiram são desativadas (não apagadas: pedidos antigos apontam para elas).
 */
const Entrada = z.object({
  produtoId: z.string(),
  opcoes: z.array(z.string().trim().min(1).max(30)).max(3),
  variantes: z
    .array(
      z.object({
        id: z.string().optional(),
        valores: z.record(z.string(), z.string().trim().min(1).max(40)),
        sku: z.string().trim().max(60).optional().nullable(),
        precoCentavos: z.number().int().nonnegative().optional().nullable(),
        estoque: z.number().int().nonnegative().optional().nullable(),
        pesoKg: z.number().positive().optional().nullable(),
        imagem: z.string().url().optional().nullable(),
      }),
    )
    .max(200),
});

export async function PUT(request: Request) {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Dados inválidos.", detalhes: r.error.flatten() }, { status: 422 });

  const produto = await prisma.produto.findFirst({ where: { id: r.data.produtoId, tenantId: loja.id } });
  if (!produto) return Response.json({ erro: "Produto não encontrado." }, { status: 404 });

  const opcoes = r.data.opcoes;
  const nomeDe = (valores: Record<string, string>) => opcoes.map((o) => valores[o] ?? "?").join(" / ");

  await prisma.$transaction(async (tx) => {
    await tx.produto.update({ where: { id: produto.id }, data: { opcoes } });
    const mantidos: string[] = [];
    let ordem = 0;
    for (const v of r.data.variantes) {
      const dados = { valores: v.valores, nome: nomeDe(v.valores), sku: v.sku ?? null, precoCentavos: v.precoCentavos ?? null, estoque: v.estoque ?? null, pesoKg: v.pesoKg ?? null, imagem: v.imagem ?? null, ativo: true, ordem: ordem++ };
      if (v.id) {
        const existe = await tx.variante.findFirst({ where: { id: v.id, produtoId: produto.id } });
        if (existe) {
          await tx.variante.update({ where: { id: v.id }, data: dados });
          mantidos.push(v.id);
          continue;
        }
      }
      const criada = await tx.variante.create({ data: { ...dados, produtoId: produto.id } });
      mantidos.push(criada.id);
    }
    await tx.variante.updateMany({ where: { produtoId: produto.id, id: { notIn: mantidos } }, data: { ativo: false } });
  });

  const variantes = await prisma.variante.findMany({ where: { produtoId: produto.id, ativo: true }, orderBy: { ordem: "asc" } });
  return Response.json({ opcoes, variantes });
}

/** GET ?produtoId= — grade atual. */
export async function GET(request: Request) {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  const produtoId = new URL(request.url).searchParams.get("produtoId") ?? "";
  const produto = await prisma.produto.findFirst({ where: { id: produtoId, tenantId: loja.id }, include: { variantes: { where: { ativo: true }, orderBy: { ordem: "asc" } } } });
  if (!produto) return Response.json({ erro: "Produto não encontrado." }, { status: 404 });
  return Response.json({ opcoes: produto.opcoes, variantes: produto.variantes });
}
