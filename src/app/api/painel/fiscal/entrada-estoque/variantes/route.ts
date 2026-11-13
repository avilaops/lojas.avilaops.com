import { prisma } from "@/lib/db";
import { exigir, permite } from "@/lib/operadores";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const { s, erro } = await exigir("fiscal");
  if (erro) return erro;
  const headers = { "Cache-Control": "private, no-store" };
  if (!permite(s.papel, "catalogo")) return Response.json({ erro: "Sem permissão para consultar produtos." }, { status: 403, headers });
  const q = (new URL(request.url).searchParams.get("q") ?? "").trim();
  if (q.length > 80) return Response.json({ erro: "Busque com até80caracteres." }, { status: 400, headers });
  const [variantes, saldos] = await Promise.all([
    q.length < 2 ? [] : prisma.variante.findMany({
      where: { tenantId: s.tenant.id, ativo: true, produto: { ativo: true }, OR: [{ produto: { nome: { contains: q, mode: "insensitive" } } }, { sku: { contains: q, mode: "insensitive" } }, { gtin: { contains: q } }, { nome: { contains: q, mode: "insensitive" } }] },
      select: { id: true, nome: true, sku: true, gtin: true, produto: { select: { nome: true } } },
      orderBy: [{ produto: { nome: "asc" } }, { ordem: "asc" }, { id: "asc" }], take: 20,
    }),
    prisma.saldoEstoque.findMany({ where: { tenantId: s.tenant.id }, distinct: ["local"], select: { local: true }, orderBy: { local: "asc" }, take: 30 }),
  ]);
  return Response.json({ itens: variantes.map(v => ({ id: v.id, nome: v.produto.nome, variacao: v.nome, sku: v.sku, gtin: v.gtin })), locais: [...new Set(["principal", ...saldos.map(s => s.local)])] }, { headers });
}
