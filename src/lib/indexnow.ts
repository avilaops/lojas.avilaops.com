import { createHmac } from "node:crypto";
import type { Tenant } from "@prisma/client";
import { urlDaLoja } from "./tenant";

/**
 * Indexação garantida — o diferencial da plataforma.
 *
 * Toda loja é avisada aos buscadores sem o lojista fazer nada:
 *
 *   - **IndexNow** (Bing, Yandex, Naver, Seznam): protocolo de ping instantâneo.
 *     A chave é derivada do LOJAS_SECRET + slug, então é estável, não precisa de
 *     tabela e é servida em /indexnow-key.txt no domínio da própria loja.
 *   - **Sitemap ping** (Google e Bing): avisa que o sitemap mudou.
 *
 * Nada disso pode derrubar uma operação: falha vira log.
 */
const ENDPOINTS_INDEXNOW = ["https://api.indexnow.org/indexnow", "https://www.bing.com/indexnow"];

export function chaveIndexNow(slug: string): string {
  const segredo = process.env.LOJAS_SECRET ?? "lojas";
  // 32 hex: formato aceito pelo IndexNow (8–128 caracteres, hex).
  return createHmac("sha256", segredo).update(`indexnow:${slug}`).digest("hex").slice(0, 32);
}

/** Avisa os buscadores sobre URLs que nasceram ou mudaram. */
export async function avisarBuscadores(t: Tenant, caminhos: string[] = ["/"]): Promise<void> {
  if (t.status !== "ATIVA") return;
  const base = urlDaLoja(t);
  const host = base.replace(/^https?:\/\//, "");
  const urls = Array.from(new Set(caminhos.map((c) => `${base}${c.startsWith("/") ? c : `/${c}`}`))).slice(0, 10000);
  const corpo = JSON.stringify({ host, key: chaveIndexNow(t.slug), keyLocation: `${base}/indexnow-key.txt`, urlList: urls });

  await Promise.allSettled([
    ...ENDPOINTS_INDEXNOW.map((url) =>
      fetch(url, { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body: corpo, signal: AbortSignal.timeout(8000) }),
    ),
    // Ping de sitemap: o Google descontinuou o endpoint próprio, mas o do Bing
    // segue valendo e custa nada.
    fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(`${base}/sitemap.xml`)}`, { signal: AbortSignal.timeout(8000) }),
  ]).then((rs) => {
    const falhas = rs.filter((r) => r.status === "rejected").length;
    if (falhas) console.warn(`[indexnow] ${falhas} endpoint(s) não responderam para ${host}`);
  });
}

/** Caminhos que valem avisar quando o catálogo muda. */
export function caminhosDoProduto(slug: string, categoriaSlug?: string | null): string[] {
  return ["/", "/produtos", `/produtos/${slug}`, ...(categoriaSlug ? [`/categoria/${categoriaSlug}`] : [])];
}
