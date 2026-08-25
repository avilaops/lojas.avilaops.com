import { headers } from "next/headers";
import { tenantAtual, urlDaLoja } from "@/lib/tenant";

export const dynamic = "force-dynamic";

export async function GET() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  const baseDomain = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();
  if (host === baseDomain) {
    return new Response(`# Lojas Avila Ops\n\n> Plataforma brasileira de comércio digital com identidade, checkout e automação.\n\n- Site: https://${baseDomain}\n- Criar loja: https://${baseDomain}/criar\n- Conteúdo completo para agentes: https://${baseDomain}/llms-full.txt\n`, { headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const t = await tenantAtual();
  if (!t || t.status !== "ATIVA") return new Response("Loja não encontrada.\n", { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } });
  const base = urlDaLoja(t);
  return new Response(`# ${t.nome}\n\n> ${t.slogan ?? `Loja virtual ${t.nome}`}\n\n- Site: ${base}\n- Catálogo: ${base}/produtos\n- Conteúdo completo para agentes: ${base}/llms-full.txt\n`, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
