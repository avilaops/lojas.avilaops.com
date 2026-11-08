import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { registrarEntradaEquipe } from "@/lib/entrada-equipe";
import { configSSO, CAMINHO_RETORNO } from "@/lib/sso";
import { normalizarHost } from "@/lib/tenant";
import { configOIDC, criarFluxoOIDC, COOKIE_FLUXO_OIDC, urlAutorizacaoOIDC } from "@/lib/oidc";

export const dynamic = "force-dynamic";

// Apenas uma escolha explícita de entrada cria a autorização temporária para listar lojas.
export async function GET() {
  const cfg = configSSO();
  const base = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();
  if (!cfg || normalizarHost((await headers()).get("host")) !== base)
    return new Response(null, { status: 404 });
  const oidc = configOIDC();
  if (!oidc && process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(base)) return Response.json({ erro: "Configure a integração OIDC deste ambiente no Auth." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  await registrarEntradaEquipe();
  if (oidc) {
    const fluxo = criarFluxoOIDC();
    const resposta = NextResponse.redirect(urlAutorizacaoOIDC(oidc, fluxo));
    resposta.cookies.set(COOKIE_FLUXO_OIDC, fluxo.cookie, { httpOnly: true, sameSite: "lax", secure: oidc.segura, path: "/", maxAge: 600 });
    resposta.headers.set("Cache-Control", "no-store");
    return resposta;
  }
  const response = NextResponse.redirect(new URL(CAMINHO_RETORNO, `https://${base}`));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
