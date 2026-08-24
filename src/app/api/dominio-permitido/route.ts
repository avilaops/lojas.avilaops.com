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
  return t && t.status !== "CANCELADA" ? new Response("ok") : new Response("não", { status: 404 });
}
