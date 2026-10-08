/**
 * Confere se uma loja nasceu publicável: o que o Google, o Bing e o ChatGPT
 * precisam encontrar, no nosso servidor, sem chamar buscador nenhum.
 *
 *   npx tsx scripts/conferir-publicacao.ts https://vedashow.com.br
 *   npx tsx scripts/conferir-publicacao.ts https://demo.lojas.avilaops.com
 *
 * Sai com código 1 se alguma verificação falhar. Serve para rodar depois de
 * criar uma loja, depois de apontar domínio próprio e depois de cada deploy.
 * O que ele confere é o contrato de publicação da plataforma:
 *
 *   - / , /robots.txt , /sitemap.xml , /llms.txt , uma categoria e um
 *     produto respondem 200, em HTML/XML/texto, sem redirect;
 *   - o canonical de cada página está no host oficial (o do sitemap);
 *   - o sitemap só tem URLs do host oficial e nenhuma privada;
 *   - nenhuma página pública tem noindex; o carrinho tem;
 *   - o produto traz JSON-LD Product com Offer e o texto essencial no HTML
 *     entregue (sem JavaScript);
 *   - o robots libera busca (Googlebot, Bingbot, OAI-SearchBot) e aponta o
 *     sitemap do host oficial;
 *   - Googlebot, Googlebot-Image, Bingbot, OAI-SearchBot e ChatGPT-User
 *     recebem 200 nas mesmas páginas (a cadeia toda: DNS, Caddy, Next);
 *   - a home declara rel="describedby" para o llms.txt.
 */

const base = (process.argv[2] ?? "").replace(/\/$/, "");
if (!/^https?:\/\//.test(base)) {
  console.error("uso: npx tsx scripts/conferir-publicacao.ts https://loja.exemplo.com.br");
  process.exit(2);
}

const CRAWLERS: Record<string, string> = {
  "Googlebot": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
  "Googlebot-Image": "Googlebot-Image/1.0",
  "Bingbot": "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
  "OAI-SearchBot": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.4; +https://openai.com/searchbot",
  "ChatGPT-User": "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot",
};

type Resultado = { nome: string; ok: boolean; detalhe?: string };
const resultados: Resultado[] = [];
const ok = (nome: string, cond: boolean, detalhe?: string) => resultados.push({ nome, ok: cond, detalhe });

async function pegar(caminho: string, ua?: string) {
  const r = await fetch(`${base}${caminho}`, { redirect: "manual", headers: ua ? { "user-agent": ua } : {} });
  const corpo = await r.text();
  return { status: r.status, tipo: r.headers.get("content-type") ?? "", corpo, cabecalhos: r.headers };
}

const canonicalDe = (html: string) => html.match(/<link rel="canonical" href="([^"]+)"/)?.[1] ?? null;
const robotsDe = (html: string) => html.match(/<meta name="robots" content="([^"]+)"/)?.[1] ?? "";
const jsonLdDe = (html: string) =>
  [...html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)].map((m) => {
    try {
      return JSON.parse(m[1]) as Record<string, unknown>;
    } catch {
      return {};
    }
  });

async function main() {
  // 1. Home
  const home = await pegar("/");
  ok("GET / responde 200 em HTML", home.status === 200 && home.tipo.includes("text/html"), `${home.status} ${home.tipo}`);
  const canonicalHome = canonicalDe(home.corpo);
  ok("home tem canonical", Boolean(canonicalHome), canonicalHome ?? "ausente");
  const hostOficial = canonicalHome ? new URL(canonicalHome).host : new URL(base).host;
  ok("home sem noindex", !robotsDe(home.corpo).includes("noindex"), robotsDe(home.corpo));
  ok("home declara rel=describedby para /llms.txt", /rel="describedby" href="\/llms\.txt"/.test(home.corpo));
  const tiposHome = jsonLdDe(home.corpo).map((d) => d["@type"]);
  ok("home tem JSON-LD Store/Organization e WebSite", tiposHome.some((t) => t === "Store" || t === "Organization") && tiposHome.includes("WebSite"), tiposHome.join(","));

  // 2. robots.txt
  const robots = await pegar("/robots.txt");
  ok("GET /robots.txt 200 text/plain", robots.status === 200 && robots.tipo.includes("text/plain"), `${robots.status} ${robots.tipo}`);
  const sitemapNoRobots = robots.corpo.match(/^Sitemap:\s*(\S+)/im)?.[1] ?? "";
  ok("robots aponta o sitemap do host oficial", sitemapNoRobots === `https://${hostOficial}/sitemap.xml`, sitemapNoRobots);
  const grupos = robots.corpo.split(/\n\s*\n/);
  const grupoDe = (ua: string) => grupos.find((g) => new RegExp(`^User-Agent:\\s*${ua}\\s*$`, "im").test(g)) ?? grupos.find((g) => /^User-Agent:\s*\*\s*$/im.test(g)) ?? "";
  for (const ua of ["Googlebot", "Bingbot", "OAI-SearchBot"]) {
    const g = grupoDe(ua);
    ok(`robots libera ${ua}`, /^Allow:\s*\/\s*$/im.test(g) && !/^Disallow:\s*\/\s*$/im.test(g), g.replace(/\n/g, " | ").slice(0, 120));
  }
  ok("robots fecha o carrinho e o checkout", /Disallow:\s*\/carrinho/i.test(robots.corpo) && /Disallow:\s*\/checkout/i.test(robots.corpo));

  // 3. sitemap.xml
  const sitemap = await pegar("/sitemap.xml");
  ok("GET /sitemap.xml 200 XML", sitemap.status === 200 && /xml/.test(sitemap.tipo), `${sitemap.status} ${sitemap.tipo}`);
  const locs = [...sitemap.corpo.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  ok("sitemap tem URLs", locs.length > 0, String(locs.length));
  const foraDoHost = locs.filter((u) => new URL(u).host !== hostOficial);
  ok("sitemap só com o host oficial", foraDoHost.length === 0, foraDoHost.slice(0, 3).join(" "));
  const privadas = locs.filter((u) => /\/(carrinho|checkout|pedido|conta|painel|api)\b/.test(new URL(u).pathname));
  ok("sitemap sem URL privada", privadas.length === 0, privadas.slice(0, 3).join(" "));
  const comQuery = locs.filter((u) => new URL(u).search !== "");
  ok("sitemap sem parâmetros de filtro", comQuery.length === 0, comQuery.slice(0, 3).join(" "));
  ok("sitemap sem URL repetida", new Set(locs).size === locs.length);

  // 4. llms.txt
  const llms = await pegar("/llms.txt");
  ok("GET /llms.txt 200 text/plain", llms.status === 200 && llms.tipo.includes("text/plain"), `${llms.status} ${llms.tipo}`);
  ok("llms.txt começa com H1 e citação", /^# .+\n\n?> .+/m.test(llms.corpo));
  ok("llms.txt não é um sitemap (menos de 120 links)", (llms.corpo.match(/\]\(https?:/g) ?? []).length < 120, String((llms.corpo.match(/\]\(https?:/g) ?? []).length));
  ok("llms.txt só com links do host oficial", ![...llms.corpo.matchAll(/\]\((https?:[^)]+)\)/g)].some((m) => new URL(m[1]).host !== hostOficial));
  ok("llms.txt sem preço zero", !/R\$\s*0,00/.test(llms.corpo));

  // 5. Categoria e produto, os primeiros do sitemap
  const categoria = locs.find((u) => /\/categoria\//.test(u));
  const produto = locs.find((u) => /\/produtos\/[^/]+$/.test(u));
  ok("sitemap tem categoria", Boolean(categoria));
  ok("sitemap tem produto", Boolean(produto));

  if (categoria) {
    const c = await pegar(new URL(categoria).pathname);
    ok("categoria 200", c.status === 200, String(c.status));
    ok("categoria canonical no host oficial", canonicalDe(c.corpo)?.startsWith(`https://${hostOficial}/`) ?? false, canonicalDe(c.corpo) ?? "ausente");
    ok("categoria sem noindex", !robotsDe(c.corpo).includes("noindex"));
    ok("categoria linka produtos no HTML", (c.corpo.match(/href="\/produtos\/[^"]+"/g) ?? []).length > 0);
  }
  if (produto) {
    const caminho = new URL(produto).pathname;
    const p = await pegar(caminho);
    ok("produto 200", p.status === 200, String(p.status));
    ok("produto canonical igual ao sitemap", canonicalDe(p.corpo) === produto, canonicalDe(p.corpo) ?? "ausente");
    ok("produto sem noindex", !robotsDe(p.corpo).includes("noindex"));
    const prod = jsonLdDe(p.corpo).find((d) => d["@type"] === "Product") as Record<string, unknown> | undefined;
    ok("produto tem JSON-LD Product", Boolean(prod));
    const oferta = (prod?.offers ?? {}) as Record<string, unknown>;
    ok("Offer com preço, moeda e disponibilidade", oferta["@type"] === "Offer" && typeof oferta.price === "string" && oferta.priceCurrency === "BRL" && typeof oferta.availability === "string", JSON.stringify(oferta).slice(0, 120));
    ok("JSON-LD não inventa marca", !("brand" in (prod ?? {})) || (prod?.brand as { name?: string } | null)?.name !== undefined);
    const nome = String(prod?.name ?? "");
    const semScript = p.corpo.replace(/<script[\s\S]*?<\/script>/g, "");
    ok("nome do produto está no HTML sem JS", nome.length > 0 && semScript.includes(nome.replace(/&/g, "&amp;")), nome.slice(0, 60));
    ok("produto tem trilha (BreadcrumbList)", jsonLdDe(p.corpo).some((d) => d["@type"] === "BreadcrumbList"));
    ok("produto tem <h1>", /<h1[^>]*>/.test(p.corpo));

    // 6. Crawlers, a cadeia toda
    for (const [nome, ua] of Object.entries(CRAWLERS)) {
      const [h, pr] = await Promise.all([pegar("/", ua), pegar(caminho, ua)]);
      ok(`${nome} recebe 200 em / e no produto`, h.status === 200 && pr.status === 200, `${h.status}/${pr.status}`);
    }
  }

  // 7. Privado é privado
  const carrinho = await pegar("/carrinho");
  ok("carrinho sem cache compartilhado", /no-store/.test(carrinho.cabecalhos.get("cache-control") ?? ""), carrinho.cabecalhos.get("cache-control") ?? "");

  // 8. Dá para falar com a loja, e o texto entregue é texto de gente
  //
  // Uma auditoria da Vedashow achou /contato servindo um <main> de nove
  // caracteres — " Contato " — porque nenhum canal estava preenchido no
  // tenant. As três políticas mandavam falar conosco "pelos nossos canais de
  // atendimento" e não havia canal nenhum: o caminho de troca e devolução
  // terminava em nada, e o Decreto 7.962/2013 exige endereço físico e
  // eletrônico à vista. A conferência passava em tudo, porque só olhava
  // buscador. Passa a olhar o comprador também.
  const contato = await pegar("/contato");
  const semScriptNem = (html: string) => html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, "");
  ok("GET /contato 200", contato.status === 200, String(contato.status));
  ok(
    "/contato oferece ao menos um canal (telefone, e-mail, WhatsApp ou endereço)",
    /tel:|mailto:|wa\.me|api\.whatsapp\.com|<address/i.test(semScriptNem(contato.corpo)),
    "nenhum canal no HTML entregue",
  );

  // Texto de template vazando é o que faz o site parecer inacabado. Os três
  // padrões abaixo apareceram em produção ao mesmo tempo: o placeholder de
  // plural, a preposição que não concorda com o que vem depois dela, e o
  // preço zero — que é "sob consulta", nunca "de graça".
  const envio = await pegar("/politicas/envio");
  for (const [nome, corpo] of [["home", home.corpo], ["contato", contato.corpo], ["política de envio", envio.corpo]] as const) {
    const limpo = semScriptNem(corpo);
    ok(`${nome} sem placeholder de plural`, !/dia\(s\)|útil\(eis\)|item\(ns\)/i.test(limpo));
    ok(`${nome} sem erro de concordância "pelo nossos"`, !/\bpelo\s+nossos\b/i.test(limpo));
    ok(`${nome} sem preço zero à mostra`, !/R\$\s*0,00/.test(limpo));
  }

  const falhas = resultados.filter((r) => !r.ok);
  for (const r of resultados) console.log(`${r.ok ? "ok " : "FALHOU"}  ${r.nome}${r.detalhe && !r.ok ? `  ← ${r.detalhe}` : ""}`);
  console.log(`\n${resultados.length - falhas.length}/${resultados.length} verificações passaram em ${base} (host oficial: ${hostOficial})`);
  process.exit(falhas.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
