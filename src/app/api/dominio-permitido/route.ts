import { buscarTenantPorHost, slugDoHost } from "@/lib/tenant";

/**
 * "ask" do on_demand_tls do Caddy: só emitimos certificado para host que
 * pertence a uma loja. Sem isto, qualquer domínio apontado para o nosso IP
 * faria o Caddy pedir certificado à Let's Encrypt em nosso nome.
 */
export async function GET(request: Request) {
  const host = new URL(request.url).searchParams.get("domain") ?? "";
  if (slugDoHost(host.toLowerCase())) return new Response("ok");
  const t = await buscarTenantPorHost(host);
  if (t && t.status !== "CANCELADA") return new Response("ok");

  // Não é loja: devolve a pergunta para quem respondia antes de nós (Comandeiro),
  // porque o Caddy só aceita um "ask" global.
  const fallback = process.env.TLS_ASK_FALLBACK_URL;
  if (fallback) {
    try {
      const r = await fetch(`${fallback}?domain=${encodeURIComponent(host)}`, { signal: AbortSignal.timeout(3000) });
      if (r.ok) return new Response("ok");
    } catch {
      /* fallback fora do ar: nega, não emite */
    }
  }
  return new Response("não", { status: 404 });
}
