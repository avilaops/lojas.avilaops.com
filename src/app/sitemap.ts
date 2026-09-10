import type { MetadataRoute } from "next";
import { headers } from "next/headers";
import { tenantAtual, urlDaLoja } from "@/lib/tenant";
import { listarCategorias, listarProdutos, produtoPublicavel } from "@/lib/catalogo";
import { postsPublicados } from "@/lib/blog";

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
      { url: `${base}/blog`, changeFrequency: "daily", priority: 0.8 },
      // Só o que já está publicado: post com data futura ainda não existe.
      ...postsPublicados().map((p) => ({
        url: `${base}/blog/${p.slug}`,
        lastModified: new Date(`${p.publicadoEm}T12:00:00`),
        changeFrequency: "monthly" as const,
        priority: 0.7,
      })),
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
    // Só o que tem foto ou preço. A Vedashow mandava 5.589 produtos ao Google
    // com 2.100 vendáveis: o resto era nome e ficha, sem nada para exibir, e
    // milhares de páginas quase iguais derrubam as boas junto.
    ...produtos.filter(produtoPublicavel).map((p) => ({ url: `${base}/produtos/${p.slug}`, lastModified: p.atualizadoEm, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...["sobre", "contato", "politicas/envio", "politicas/devolucao", "politicas/privacidade", "politicas/termos"].map((s) => ({ url: `${base}/${s}`, priority: 0.3 })),
  ];
}
