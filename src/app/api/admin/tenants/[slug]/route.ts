import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { TenantAtualizacaoSchema } from "@/lib/admin-schemas";
import { atualizarTenant } from "@/lib/admin-tenants";

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const t = await prisma.tenant.findUnique({ where: { slug }, include: { _count: { select: { produtos: true, pedidos: true, categorias: true } } } });
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  const { mpAccessTokenEnc: _a, mpWebhookSecretEnc: _b, melhorEnvioAccessTokenEnc: _c, melhorEnvioRefreshTokenEnc: _d, mpRefreshTokenEnc: _e, ...publico } = t;
  void _a; void _b; void _c; void _d; void _e;
  return Response.json(publico);
}

/** PATCH — altera qualquer campo da loja (tema, contato, frete, gateway, status). */
export async function PATCH(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const r = TenantAtualizacaoSchema.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "dados inválidos", detalhes: r.error.flatten() }, { status: 422 });
  try {
    const t = await atualizarTenant(slug, r.data);
    return Response.json({ slug: t.slug, status: t.status, atualizadoEm: t.atualizadoEm });
  } catch {
    return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  }
}
