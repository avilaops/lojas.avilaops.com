import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { tenantAtual } from "@/lib/tenant";
import { regrasRobots } from "@/lib/descoberta";

export const dynamic = "force-dynamic";

/**
 * robots.txt é por host. O domínio-base é a plataforma; qualquer outro host é
 * uma loja, e a regra dela vive em `descoberta.ts` (busca sempre liberada,
 * treinamento é decisão da loja).
 *
 * O subdomínio de uma loja com domínio próprio recebe o MESMO robots do
 * domínio, com o sitemap apontando para o oficial. Não se bloqueia o
 * subdomínio aqui de propósito: página bloqueada não é rastreada, e sem
 * rastrear o Google não lê o `noindex` que está nela (ver layout.tsx).
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  const baseDomain = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();
  if (host === baseDomain) {
    return {
      rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/painel", "/entrar", "/recuperar", "/redefinir"] },
      sitemap: `https://${baseDomain}/sitemap.xml`,
    };
  }
  const t = await tenantAtual();
  if (!t) return { rules: { userAgent: "*", disallow: "/" } };
  return regrasRobots(t);
}
