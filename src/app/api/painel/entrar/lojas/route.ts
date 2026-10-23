import { cookies, headers } from "next/headers";
import { configSSO, consultarSSO, COOKIE_SSO } from "@/lib/sso";
import { lojasAutorizadas } from "@/lib/acessos-loja";
import { abrirSessao } from "@/lib/sessao";
import { normalizarHost } from "@/lib/tenant";

export async function POST(request: Request) {
  const base = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();
  const h = await headers();
  if (normalizarHost(h.get("host")) !== base || h.get("origin") !== `https://${base}`) return new Response(null, { status: 403 });
  const cfg = configSSO();
  if (!cfg) return new Response(null, { status: 404 });
  const r = await consultarSSO(cfg, (await cookies()).get(COOKIE_SSO)?.value);
  if (r.tipo !== "ok") return new Response(null, { status: 401 });
  const slug = (await request.formData()).get("slug");
  if (typeof slug !== "string" || !/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)) return new Response(null, { status: 400 });
  const loja = (await lojasAutorizadas(r.email)).find(t => t.slug === slug);
  if (!loja) return new Response(null, { status: 403 });
  await abrirSessao(loja.slug, null, { identidadeEmail: r.email });
  return new Response(null, { status: 303, headers: { Location: "/painel", "Cache-Control": "no-store" } });
}
