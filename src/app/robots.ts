import type { MetadataRoute } from "next";
import { tenantAtual, urlDaLoja } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const t = await tenantAtual();
  if (!t || t.status !== "ATIVA") return { rules: { userAgent: "*", disallow: "/" } };
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/carrinho", "/checkout", "/pedido/", "/api/"] },
    sitemap: `${urlDaLoja(t)}/sitemap.xml`,
  };
}
