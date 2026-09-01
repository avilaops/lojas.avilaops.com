import { NextResponse, type NextRequest } from "next/server";

/**
 * Um servidor, dois "sites":
 *
 *   - <slug>.lojas.avilaops.com e domínios próprios → a loja (rotas na raiz de src/app)
 *   - lojas.avilaops.com (o domínio-base)           → a plataforma: página de venda,
 *     criar loja, painel do lojista (src/app/plataforma)
 *
 * O proxy só reescreve o caminho quando o Host é o domínio-base; o resto é
 * intocado. A tela do lojista vive aqui, e não num portal separado, de
 * propósito: sem tela não é entrega, e a plataforma tem que se bastar.
 */
const BASE = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();

export function proxy(request: NextRequest) {
  const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  const { pathname } = request.nextUrl;

  // /v1 é o contrato do Padrão Oficial e mora na raiz de src/app, como /api:
  // sem esta exceção o caminho viraria /plataforma/v1 e o coletor receberia 404
  // de uma app que está de pé.
  if (host === BASE && !pathname.startsWith("/api/") && !pathname.startsWith("/v1/") && !pathname.startsWith("/plataforma")) {
    const url = request.nextUrl.clone();
    url.pathname = `/plataforma${pathname === "/" ? "" : pathname}`;
    // Cabeçalho de REQUISIÇÃO: é o que o layout raiz lê com headers().
    const cabecalhos = new Headers(request.headers);
    cabecalhos.set("x-plataforma", "1");
    return NextResponse.rewrite(url, { request: { headers: cabecalhos } });
  }

  // Loja tentando abrir rotas da plataforma pelo próprio domínio: não existe.
  if (host !== BASE && pathname.startsWith("/plataforma")) {
    return NextResponse.rewrite(new URL("/nao-encontrado", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|robots.txt|sitemap.xml|llms.txt|llms-full.txt|site.webmanifest|lojas-mark.svg|media/|uploads/).*)"],
};
