import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { tenantAtual, urlDaLoja } from "@/lib/tenant";

export const dynamic = "force-dynamic";

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
  if (!t || t.status !== "ATIVA") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/carrinho", "/checkout", "/pedido/", "/api/"] },
    sitemap: `${urlDaLoja(t)}/sitemap.xml`,
  };
}
