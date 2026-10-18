import { z } from "zod";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { salvarCatalogoB2B } from "@/lib/catalogo-b2b";
import { EntradaCatalogoB2BSchema } from "@/lib/catalogo-b2b-schema";
import { prisma } from "@/lib/db";

type Ctx = { params: Promise<{ slug: string }> };
const Lote = z.object({ catalogos: z.array(z.unknown()).min(1).max(500) }).strict();

export async function POST(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!tenant) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  const lote = Lote.safeParse(await request.json().catch(() => null));
  if (!lote.success) return Response.json({ erro: "lote inválido", detalhes: lote.error.flatten() }, { status: 422 });
  const gravados: Array<{ referencia: string; id: string }> = [];
  const rejeitados: Array<{ referencia: string; motivo: string }> = [];
  for (const bruto of lote.data.catalogos) {
    const referencia = typeof bruto === "object" && bruto !== null && "referencia" in bruto && typeof bruto.referencia === "string" ? bruto.referencia : "sem-referencia";
    const entrada = EntradaCatalogoB2BSchema.safeParse(bruto);
    if (!entrada.success) {
      rejeitados.push({ referencia, motivo: entrada.error.issues[0]?.message ?? "dados inválidos" });
      continue;
    }
    try {
      const catalogo = await salvarCatalogoB2B(tenant.id, entrada.data);
      gravados.push({ referencia: entrada.data.referencia, id: catalogo.id });
    } catch (erro) {
      rejeitados.push({ referencia: entrada.data.referencia, motivo: erro instanceof Error ? erro.message : "catálogo inconsistente" });
    }
  }
  return Response.json({ gravados, rejeitados });
}
