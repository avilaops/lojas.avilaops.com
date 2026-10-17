import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { TenantEntradaSchema } from "@/lib/admin-schemas";
import { criarTenant } from "@/lib/admin-tenants";
import { anunciarLojaCriada, provisionarLoja } from "@/lib/provisionar";
import { urlDaLoja } from "@/lib/tenant";

/** GET — lista as lojas (painel interno / n8n). */
export async function GET(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  const lojas = await prisma.tenant.findMany({
    select: {
      slug: true, nome: true, plano: true, status: true, dominioPrincipal: true, criadoEm: true,
      // Estado da mensalidade: o admin do app.avilaops.com cruza isto com o
      // Mercado Pago para achar divergência (pago lá, suspenso aqui).
      assinaturaId: true, assinaturaStatus: true, cobrancaIsenta: true, ultimoPagamentoEm: true, setupPagoEm: true, suspensaEm: true, tentativasFalhas: true,
      loginEmail: true, emailContato: true, whatsapp: true,
      _count: { select: { produtos: true, pedidos: true } },
    },
    orderBy: { criadoEm: "desc" },
  });
  return Response.json(lojas);
}

/**
 * POST — cria uma loja. Corpo: TenantEntradaSchema.
 * `?provisionar=1` já dispara DNS + e-mail + n8n na sequência.
 *
 * A loja responde em https://<slug>.LOJAS_BASE_DOMAIN no mesmo segundo.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) return naoAutorizado();

  const r = TenantEntradaSchema.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "dados inválidos", detalhes: r.error.flatten() }, { status: 422 });

  if (await prisma.tenant.findUnique({ where: { slug: r.data.slug } })) {
    return Response.json({ erro: `já existe loja com slug ${r.data.slug}` }, { status: 409 });
  }

  const tenant = await criarTenant(r.data);
  await anunciarLojaCriada(tenant);

  const provisionar = new URL(request.url).searchParams.get("provisionar") === "1";
  const passos = provisionar ? await provisionarLoja(tenant.slug) : undefined;

  return Response.json({ slug: tenant.slug, url: urlDaLoja(tenant), status: tenant.status, provisionamento: passos }, { status: 201 });
}
