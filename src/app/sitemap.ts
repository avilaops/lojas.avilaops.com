import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { tenantAtual, urlDaLoja } from "@/lib/tenant";
import { listarCategorias, listarProdutos } from "@/lib/catalogo";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  const baseDomain = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();
  if (host === baseDomain) {
    const base = `https://${baseDomain}`;
    return [
      { url: base, changeFrequency: "weekly", priority: 1 },
      { url: `${base}/criar`, changeFrequency: "monthly", priority: 0.9 },
      { url: `${base}/ajuda`, changeFrequency: "monthly", priority: 0.6 },
    ];
  }
  const t = await tenantAtual();
  if (!t || t.status !== "ATIVA") return [];
  const base = urlDaLoja(t);
  const [categorias, produtos] = await Promise.all([listarCategorias(t.id), listarProdutos(t.id)]);
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/produtos`, changeFrequency: "daily", priority: 0.9 },
    ...categorias.map((c) => ({ url: `${base}/categoria/${c.slug}`, lastModified: c.atualizadoEm, changeFrequency: "weekly" as const, priority: 0.7 })),
    ...produtos.map((p) => ({ url: `${base}/produtos/${p.slug}`, lastModified: p.atualizadoEm, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...["sobre", "contato", "politicas/envio", "politicas/devolucao", "politicas/privacidade"].map((s) => ({ url: `${base}/${s}`, priority: 0.3 })),
  ];
}
