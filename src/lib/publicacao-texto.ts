import { createHash } from "node:crypto";
import { lerCaminhoTexto } from "./publicacao-texto-rotas";

export type ContextoPublicacao = { id: string; urlBase: string; publicavel: boolean };
export type DependenciasPublicacao = {
  origemInterna: string;
  resolverHost: (host: string) => Promise<ContextoPublicacao | null>;
  buscarHtml: typeof fetch;
};

function indisponivel(status = 404) {
  return new Response("Conteúdo público não disponível.\n", { status, headers: { "cache-control": "no-store", "content-type": "text/plain; charset=utf-8", "x-robots-tag": "noindex", "x-content-type-options": "nosniff" } });
}

function hostValido(valor: string): string | null {
  if (valor.length > 260 || /[\s/@\\,%?#]/.test(valor)) return null;
  const host = valor.toLowerCase().replace(/:\d{1,5}$/, "").replace(/\.$/, "");
  return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)*$/.test(host) ? host : null;
}

export async function responderTextoPublico(pedido: { host: string; caminhoTexto: string; ifNoneMatch?: string | null }, deps: DependenciasPublicacao): Promise<Response> {
  const host = hostValido(pedido.host);
  if (!host) return indisponivel();
  const baseDomain = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();
  const site = host === baseDomain ? "plataforma" : "loja";
  const rota = lerCaminhoTexto(pedido.caminhoTexto, site);
  if (!rota) return indisponivel();
  try {
    const contexto = await deps.resolverHost(host);
    if (!contexto?.publicavel) return indisponivel();
    const base = new URL(contexto.urlBase);
    if (base.protocol !== "https:" || base.username || base.password || base.host !== host || base.pathname !== "/" || base.search || base.hash) return indisponivel();
    const origem = new URL(deps.origemInterna);
    if (origem.protocol !== "http:" || origem.hostname !== "127.0.0.1" || origem.username || origem.password || origem.pathname !== "/" || origem.search || origem.hash) return indisponivel(503);
    const urlHtml = new URL(rota.caminhoHtml, base);
    const interna = new URL(rota.caminhoHtml, origem);
    const renderizada = await deps.buscarHtml(interna, {
      method: "GET", redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(15_000),
      headers: { host, "x-forwarded-host": host, accept: "text/html", "user-agent": "Lojas-Publicacao-Texto/1.0" },
    });
    // Não seguir Location nem publicar corpo de login ou erro.
    if (renderizada.status !== 200 || renderizada.redirected || renderizada.headers.has("www-authenticate")) return indisponivel(renderizada.status >= 500 ? 503 : 404);
    if (!/^text\/html(?:;|$)/i.test(renderizada.headers.get("content-type") ?? "") || /\b(?:noindex|none)\b/i.test(renderizada.headers.get("x-robots-tag") ?? "")) return indisponivel();
    const { converterHtml } = await import("@avilaops/publicacao-texto");
    const texto = converterHtml(await renderizada.text(), { url: urlHtml.href, formato: rota.formato });
    if (!texto.indexavel) return indisponivel();
    const etag = `"${createHash("sha256").update([contexto.id, host, rota.caminhoHtml, rota.formato, texto.conteudo].join("\0")).digest("hex")}"`;
    const headers = {
      "content-type": `${rota.formato === "md" ? "text/markdown" : "text/mdx"}; charset=utf-8`,
      "cache-control": "no-store", etag, vary: "Host, X-Forwarded-Host",
      "x-content-type-options": "nosniff", "x-robots-tag": "noindex, follow",
      link: `<${urlHtml.href}>; rel="canonical", </llms.txt>; rel="describedby"`,
    };
    const coincide = pedido.ifNoneMatch?.split(",").some(valor => valor.trim() === "*" || valor.trim().replace(/^W\//, "") === etag);
    return coincide ? new Response(null, { status: 304, headers }) : new Response(texto.conteudo, { headers });
  } catch {
    return indisponivel(503);
  }
}
