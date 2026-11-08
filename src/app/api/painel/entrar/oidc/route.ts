import { cookies, headers } from "next/headers";
import { NextResponse } from "next/server";
import { configOIDC, COOKIE_FLUXO_OIDC, COOKIE_SESSAO_OIDC, lerFluxoOIDC, trocarCodigoOIDC } from "@/lib/oidc";
import { CAMINHO_RETORNO } from "@/lib/sso";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const cfg = configOIDC();
  if (!cfg || (await headers()).get("host") !== new URL(cfg.redirectUri).host) return new Response(null, { status: 404 });
  const q = new URL(request.url).searchParams;
  const store = await cookies();
  const fluxo = lerFluxoOIDC(store.get(COOKIE_FLUXO_OIDC)?.value, q.get("state"));
  store.delete(COOKIE_FLUXO_OIDC);
  const code = q.get("code");
  const falha = () => {
    const resposta = NextResponse.redirect(new URL("/entrar?sso=indisponivel", cfg.origem));
    resposta.headers.set("Cache-Control", "no-store");
    resposta.headers.set("Referrer-Policy", "no-referrer");
    return resposta;
  };
  if (!fluxo || !code || code.length > 4096 || q.has("error")) return falha();
  try {
    const sessao = await trocarCodigoOIDC(cfg, fluxo, code);
    const resposta = NextResponse.redirect(new URL(CAMINHO_RETORNO, cfg.origem));
    resposta.cookies.set(COOKIE_SESSAO_OIDC, sessao.envelope, { httpOnly: true, sameSite: "lax", secure: cfg.segura, path: "/", maxAge: sessao.maxAge });
    resposta.headers.set("Cache-Control", "no-store");
    resposta.headers.set("Referrer-Policy", "no-referrer");
    return resposta;
  } catch { return falha(); }
}
