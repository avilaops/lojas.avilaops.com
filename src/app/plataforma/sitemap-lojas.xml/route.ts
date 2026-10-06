import { prisma } from "@/lib/db";
import { indiceDeSitemaps } from "@/lib/sitemap-lojas";

/**
 * Índice dos sitemaps das lojas, servido só no domínio-base (o proxy reescreve
 * `/sitemap-lojas.xml` para cá; numa loja este caminho não existe).
 *
 * Só loja no ar: o sitemap de loja fora do ar volta vazio, e apontar o Google
 * para arquivo vazio gasta rastreio à toa. A regra de quem entra mora em
 * `sitemap-lojas.ts`.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const baseDomain = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();
  const lojas = await prisma.tenant.findMany({
    where: { status: "ATIVA" },
    select: { slug: true, dominioPrincipal: true },
    orderBy: { slug: "asc" },
  });
  return new Response(indiceDeSitemaps(baseDomain, lojas), {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
