import { NextResponse, type NextRequest } from "next/server";import { ehRetornoDeAutorizacao, ficaNaRaiz } from "@/lib/rotas-da-raiz";


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

  // O que foi combinado com alguém de fora fica na raiz de src/app: retorno de
  // autorização (/ml, /melhor-envio) e contratos de API (/api, /v1). Sem a
  // exceção o caminho viraria /plataforma/<rota>, o lojista voltaria da
  // autorização num 404 e o token se perderia. A lista mora em rotas-da-raiz.ts.
  if (host === BASE && !ficaNaRaiz(pathname)) {
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

  // www.loja.com.br → loja.com.br, em 308.
  //
  // O domínio próprio chega com apex e www apontando para cá, e os dois serviam
  // a mesma página com 200. Para o Google isso é a loja inteira duplicada, com
  // o agravante de que o `canonical`, o sitemap e os links de e-mail usam o
  // apex (`Tenant.dominioPrincipal`): o www acumulava autoridade que o canônico
  // não aproveita. Um endereço, uma página.
  //
  // 308 e não 302 porque preserva o método: um POST de checkout que caísse no
  // www viraria GET no meio do pagamento.
  if (host.startsWith("www.") && host !== `www.${BASE}`) {
    const url = request.nextUrl.clone();
    url.host = host.slice(4);
    url.protocol = "https";
    url.port = "";
    return NextResponse.redirect(url, 308);
  }

  // Resposta de painel e de conta nunca pode ser guardada por ninguém.
  //
  // Medido em 02/09/2026: `/api/painel/equipe` voltava com
  // `cf-cache-status: HIT` e `age: 1588` — o Cloudflare estava servindo a
  // resposta de um lojista por 4 horas, e ela chegaria a outro. O cabeçalho não
  // vinha do Caddy nem do código: é regra da borda. Como a borda respeita
  // `no-store` da origem, a defesa fica aqui, que é o que está sob nosso
  // controle e não depende de configuração de painel externo.
  const resposta = NextResponse.next();
  if (pathname.startsWith("/api/") || pathname.startsWith("/painel") || pathname.startsWith("/conta") || ehRetornoDeAutorizacao(pathname)) {
    resposta.headers.set("cache-control", "private, no-store, max-age=0, must-revalidate");
    return resposta;
  }

  // Vitrine de loja pode ficar um minuto na borda.
  //
  // Toda página é dinâmica (o tenant sai do Host), e o Next responde isso com
  // `no-store`. O resultado, medido em 10/09/2026 na Vedashow: 3,1 s até o
  // primeiro byte numa home de catálogo, e cada visitante pagando a renderização
  // inteira de novo. Catálogo não muda a cada segundo; um minuto de cache e
  // dez de "sirva o velho enquanto renova" tiram o servidor do caminho de quem
  // só está olhando.
  //
  // Só quando o pedido não traz cookie nosso. Conta (`loja_conta`) e moto
  // escolhida (`minha-moto`) mudam a página, e uma cópia guardada com a moto
  // de um comprador chegaria ao próximo; o carrinho é do navegador e não
  // entra nisso. Sessão de lojista (`lojas_sessao`) nem pisa aqui, mas a
  // regra é a mesma: com cookie, resposta é de quem pediu.
  if (host !== BASE && request.method === "GET" && paginaDeVitrine(pathname) && !temCookieNosso(request)) {
    resposta.headers.set("cache-control", "public, s-maxage=60, stale-while-revalidate=600");
  }
  return resposta;
}

/** As páginas que qualquer visitante vê igual: home, catálogo, produto, institucionais. */
function paginaDeVitrine(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/produtos" ||
    pathname.startsWith("/produtos/") ||
    pathname.startsWith("/categoria/") ||
    pathname === "/sobre" ||
    pathname === "/contato" ||
    pathname.startsWith("/politicas/")
  );
}

function temCookieNosso(request: NextRequest): boolean {
  return ["loja_conta", "lojas_sessao", "minha-moto"].some((nome) => request.cookies.has(nome));
}

export const config = {
  matcher: ["/((?!_next/|favicon.ico|robots.txt|sitemap.xml|llms.txt|llms-full.txt|site.webmanifest|lojas-mark.svg|media/|uploads/).*)"],
};
