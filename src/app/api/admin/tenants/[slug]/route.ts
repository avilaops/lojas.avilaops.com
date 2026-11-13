import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { TenantAtualizacaoAdminSchema } from "@/lib/admin-schemas";
import { atualizarTenant } from "@/lib/admin-tenants";
import { recusarLayoutBloqueado } from "@/lib/flags";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const t = await prisma.tenant.findUnique({ where: { slug }, include: { _count: { select: { produtos: true, pedidos: true, categorias: true } } } });
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  // Tokens cifrados e o hash de senha pertencem só ao servidor. O hash não
  // termina em Enc; conferir apenas o sufixo deixava essa credencial na API.
  const publico = Object.fromEntries(Object.entries(t).filter(([campo]) => !campo.endsWith("Enc") && campo !== "senhaHash"));
  return Response.json(publico);
}

/** PATCH — altera qualquer campo da loja (tema, contato, frete, gateway, status). */
export async function PATCH(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const r = TenantAtualizacaoAdminSchema.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "dados inválidos", detalhes: r.error.flatten() }, { status: 422 });
  if (r.data.tema?.layout === "atelie") {
    const atual = await prisma.tenant.findUnique({ where: { slug }, select: { tema: true } });
    if (!atual) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
    const bloqueio = recusarLayoutBloqueado(atual.tema, r.data.tema.layout);
    if (bloqueio) return Response.json({ erro: bloqueio }, { status: 422 });
  }
  try {
    const t = await atualizarTenant(slug, r.data);
    return Response.json({ slug: t.slug, status: t.status, atualizadoEm: t.atualizadoEm });
  } catch {
    return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  }
}
