import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";

type Contexto = { id: string; urlBase: string; publicavel: boolean };
type Dependencias = {
  origemInterna: string;
  resolverHost: (host: string) => Promise<Contexto | null>;
  buscarHtml: typeof fetch;
};

const lojas: Record<string, Contexto> = {
  "a.lojas.avilaops.com": { id: "loja-a", urlBase: "https://a.lojas.avilaops.com", publicavel: true },
  "b.lojas.avilaops.com": { id: "loja-b", urlBase: "https://b.lojas.avilaops.com", publicavel: true },
  "lojas.avilaops.com": { id: "plataforma", urlBase: "https://lojas.avilaops.com", publicavel: true },
};

function pagina(titulo: string, corpo = "Conteúdo publicado.", meta = "") {
  return `<!doctype html><html lang="pt-BR"><head><title>${titulo}</title>${meta}</head><body><main><h1>${titulo}</h1><p>${corpo}</p></main></body></html>`;
}

function dependencias(buscarHtml: typeof fetch): Dependencias {
  return { origemInterna: "http://127.0.0.1:3080", resolverHost: async host => lojas[host] ?? null, buscarHtml };
}

test("conversor fixado funciona no runtime de testes do aplicativo", async () => {
  const { converterHtml } = await import("@avilaops/publicacao-texto");
  const resultado = converterHtml(pagina("Contrato do conversor"), { url: "https://a.lojas.avilaops.com/produtos/mesmo", formato: "mdx" });
  assert.equal(resultado.indexavel, true);
  assert.match(resultado.conteudo, /# Contrato do conversor/);
});

async function publicar(host: string, caminho: string, deps: Dependencias, adicionais: Record<string, string> = {}) {
  const pedido = new NextRequest(`https://${host}${caminho}`, { headers: { host, ...adicionais } });
  const roteada = proxy(pedido);
  if (roteada.status === 404) return new Response(null, { status: 404 });
  const reescrita = roteada.headers.get("x-middleware-rewrite");
  assert.ok(reescrita, "a URL textual precisa chegar ao publicador público");
  const destino = new URL(reescrita);
  assert.equal(destino.pathname, "/api/publicacao-texto", "a URL textual deve usar o publicador, sem renderizar uma página inexistente");
  assert.equal(destino.searchParams.get("caminho"), caminho);
  // A primeira asserção usa o proxy real e demonstra a funcionalidade ausente
  // no RED. A importação só ocorre depois do roteamento chegar ao publicador.
  const { responderTextoPublico } = await import("./publicacao-texto");
  return responderTextoPublico({ host, caminhoTexto: destino.searchParams.get("caminho")!, ifNoneMatch: pedido.headers.get("if-none-match") }, deps);
}

test("duas lojas com o mesmo slug recebem conteúdo e ETags próprios", async () => {
  const deps = dependencias(async (_url, opcoes) => {
    const host = new Headers(opcoes?.headers).get("host");
    return new Response(pagina(host === "a.lojas.avilaops.com" ? "Produto A" : "Produto B"), { headers: { "content-type": "text/html" } });
  });
  const a = await publicar("a.lojas.avilaops.com", "/produtos/mesmo/index.mdx", deps);
  const b = await publicar("b.lojas.avilaops.com", "/produtos/mesmo/index.mdx", deps);
  assert.equal(a.status, 200);
  assert.equal(b.status, 200);
  assert.match(await a.text(), /# Produto A/);
  assert.match(await b.text(), /# Produto B/);
  assert.notEqual(a.headers.get("etag"), b.headers.get("etag"));
  assert.equal(a.headers.get("cache-control"), "no-store");
  assert.match(a.headers.get("content-type") ?? "", /^text\/mdx;/);
});

test("alteração e remoção são relidas mesmo com ETag anterior", async () => {
  let estado = "Anterior";
  let chamadas = 0;
  const deps = dependencias(async () => {
    chamadas++;
    return estado === "removido" ? new Response("Não existe", { status: 404 }) : new Response(pagina(estado), { headers: { "content-type": "text/html" } });
  });
  const antes = await publicar("a.lojas.avilaops.com", "/produtos/mesmo/index.md", deps);
  const tag = antes.headers.get("etag")!;
  estado = "Atualizado";
  const depois = await publicar("a.lojas.avilaops.com", "/produtos/mesmo/index.md", deps, { "if-none-match": tag });
  assert.equal(depois.status, 200);
  assert.match(await depois.text(), /# Atualizado/);
  assert.notEqual(depois.headers.get("etag"), tag);
  estado = "removido";
  const removido = await publicar("a.lojas.avilaops.com", "/produtos/mesmo/index.md", deps, { "if-none-match": tag });
  assert.equal(removido.status, 404);
  assert.doesNotMatch(await removido.text(), /Anterior|Atualizado/);
  assert.equal(chamadas, 3);
});

test("ETag só gera 304 depois de conferir o conteúdo atual", async () => {
  let chamadas = 0;
  const deps = dependencias(async () => {
    chamadas++;
    return new Response(pagina("Publicado"), { headers: { "content-type": "text/html" } });
  });
  const primeira = await publicar("a.lojas.avilaops.com", "/index.md", deps);
  const segunda = await publicar("a.lojas.avilaops.com", "/index.md", deps, { "if-none-match": primeira.headers.get("etag")! });
  assert.equal(segunda.status, 304);
  assert.equal(await segunda.text(), "");
  assert.equal(chamadas, 2);
});

test("origem interna é fixa e nunca recebe cookies ou credenciais do visitante", async () => {
  const deps = dependencias(async (url, opcoes) => {
    assert.equal(String(url), "http://127.0.0.1:3080/produtos/mesmo");
    assert.equal(opcoes?.redirect, "manual");
    assert.equal(opcoes?.cache, "no-store");
    const h = new Headers(opcoes?.headers);
    assert.equal(h.get("host"), "a.lojas.avilaops.com");
    assert.equal(h.get("x-forwarded-host"), "a.lojas.avilaops.com");
    assert.equal(h.get("cookie"), null);
    assert.equal(h.get("authorization"), null);
    return new Response(pagina("Público"), { headers: { "content-type": "text/html" } });
  });
  const resposta = await publicar("a.lojas.avilaops.com", "/produtos/mesmo/index.md", deps, { cookie: "loja_conta=privado; minha-moto=privada", authorization: "Bearer visitante" });
  assert.equal(resposta.status, 200);
  assert.match(await resposta.text(), /Público/);
});

test("host externo não resolvido não causa fetch nem exportação", async () => {
  let chamadas = 0;
  const resposta = await publicar("externo.example", "/produtos/mesmo/index.md", dependencias(async () => { chamadas++; return new Response(pagina("Não deve aparecer")); }));
  assert.equal(resposta.status, 404);
  assert.equal(chamadas, 0);
});

for (const caminho of ["/checkout/index.md", "/conta/index.mdx", "/painel/index.md", "/api/cliente/index.md", "/pedido/abc/index.md", "/%63onta/index.md", "/%2570ainel/index.mdx", "/produtos%2f..%2fconta/index.md", "/produtos%252f..%252fconta/index.md"]) {
  test(`rota privada ou separador codificado não é exportado: ${caminho}`, async () => {
    let chamadas = 0;
    const resposta = await publicar("a.lojas.avilaops.com", caminho, dependencias(async () => { chamadas++; return new Response(pagina("Segredo")); }));
    assert.equal(resposta.status, 404);
    assert.equal(chamadas, 0);
  });
}

for (const status of [401, 403, 302, 307, 500, 503]) {
  test(`resposta ${status} do renderizador não vira conteúdo público`, async () => {
    const resposta = await publicar("a.lojas.avilaops.com", "/sobre/index.md", dependencias(async () => new Response("Conteúdo restrito", { status, headers: { location: "http://169.254.169.254/latest/meta-data" } })));
    assert.notEqual(resposta.status, 200);
    assert.doesNotMatch(await resposta.text(), /Conteúdo restrito/);
  });
}

test("noindex no HTML impede exportação", async () => {
  const resposta = await publicar("a.lojas.avilaops.com", "/blog/rascunho/index.mdx", dependencias(async () => new Response(pagina("Rascunho", "Não publicar", '<meta name="robots" content="noindex">'), { headers: { "content-type": "text/html" } })));
  assert.equal(resposta.status, 404);
  assert.doesNotMatch(await resposta.text(), /Rascunho|Não publicar/);
});

test("noindex por cabeçalho também impede exportação", async () => {
  const resposta = await publicar("a.lojas.avilaops.com", "/sobre/index.md", dependencias(async () => new Response(pagina("Reservado"), { headers: { "content-type": "text/html", "x-robots-tag": "noindex, follow" } })));
  assert.equal(resposta.status, 404);
});

test("plataforma usa o próprio publicador sem virar tenant ou página inexistente", async () => {
  const resposta = await publicar("lojas.avilaops.com", "/developers/privacidade/index.md", dependencias(async (url, opcoes) => {
    assert.equal(String(url), "http://127.0.0.1:3080/developers/privacidade");
    assert.equal(new Headers(opcoes?.headers).get("host"), "lojas.avilaops.com");
    return new Response(pagina("Privacidade do desenvolvedor"), { headers: { "content-type": "text/html" } });
  }));
  assert.equal(resposta.status, 200);
  assert.match(await resposta.text(), /Privacidade do desenvolvedor/);
});

test("HTML público anuncia MD, MDX e llms sem expor caminhos operacionais", () => {
  for (const host of ["lojas.avilaops.com", "a.lojas.avilaops.com"]) {
    const resposta = proxy(new NextRequest(`https://${host}/blog/publicado`, { headers: { host } }));
    const link = resposta.headers.get("link") ?? "";
    assert.match(link, /<\/blog\/publicado\/index\.md>; rel="alternate"; type="text\/markdown"/);
    assert.match(link, /<\/blog\/publicado\/index\.mdx>; rel="alternate"; type="text\/mdx"/);
    assert.match(link, /<\/llms\.txt>; rel="describedby"/);
  }
  const privada = proxy(new NextRequest("https://a.lojas.avilaops.com/conta", { headers: { host: "a.lojas.avilaops.com" } }));
  assert.equal(privada.headers.get("link"), null);
});

test("resolvedor de outra loja ou loja não publicável não chega ao renderizador", async () => {
  for (const contexto of [lojas["b.lojas.avilaops.com"], { ...lojas["a.lojas.avilaops.com"], publicavel: false }]) {
    let chamadas = 0;
    const deps = dependencias(async () => { chamadas++; return new Response(pagina("Não publicar")); });
    deps.resolverHost = async () => contexto;
    const resposta = await publicar("a.lojas.avilaops.com", "/index.md", deps);
    assert.equal(resposta.status, 404);
    assert.equal(chamadas, 0);
  }
});

test("origem externa configurada por engano é recusada antes do fetch", async () => {
  let chamadas = 0;
  const deps = dependencias(async () => { chamadas++; return new Response(pagina("Não publicar")); });
  deps.origemInterna = "http://169.254.169.254/latest/meta-data";
  const resposta = await publicar("a.lojas.avilaops.com", "/index.md", deps);
  assert.equal(resposta.status, 503);
  assert.equal(chamadas, 0);
});

test("resposta não HTML não vira uma exportação aparentemente válida", async () => {
  const resposta = await publicar("a.lojas.avilaops.com", "/index.md", dependencias(async () => new Response('{"privado":true}', { headers: { "content-type": "application/json" } })));
  assert.equal(resposta.status, 404);
  assert.doesNotMatch(await resposta.text(), /privado/);
});

test("HTML com canonical de outra loja não cruza a fronteira do tenant", async () => {
  const deps = dependencias(async () => new Response(pagina("Produto B", "De outra loja", '<link rel="canonical" href="https://b.lojas.avilaops.com/produtos/mesmo">'), { headers: { "content-type": "text/html" } }));
  const resposta = await publicar("a.lojas.avilaops.com", "/produtos/mesmo/index.md", deps);
  assert.equal(resposta.status, 404);
  assert.doesNotMatch(await resposta.text(), /Produto B|De outra loja/);
});

test("canonical compartilhado dentro da mesma origem continua publicável", async () => {
  const deps = dependencias(async () => new Response(pagina("Produto A", "Descrição", '<link rel="canonical" href="https://a.lojas.avilaops.com/produtos/principal">'), { headers: { "content-type": "text/html" } }));
  const resposta = await publicar("a.lojas.avilaops.com", "/produtos/variante/index.md", deps);
  assert.equal(resposta.status, 200);
  assert.match(await resposta.text(), /https:\/\/a\.lojas\.avilaops\.com\/produtos\/principal/);
});

test("HTML acima do teto declarado é recusado antes da conversão", async () => {
  const deps = dependencias(async () => new Response(pagina("Conteúdo além do teto"), { headers: { "content-type": "text/html", "content-length": String(4 * 1024 * 1024 + 1) } }));
  const resposta = await publicar("a.lojas.avilaops.com", "/index.md", deps);
  assert.equal(resposta.status, 503);
  assert.doesNotMatch(await resposta.text(), /Conteúdo além do teto/);
});

test("HTML sem Content-Length interrompe a leitura ao exceder o teto em bytes", async () => {
  let cancelado = false;
  const bloco = new Uint8Array(2 * 1024 * 1024 + 1);
  const corpo = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(bloco); controller.enqueue(bloco); controller.enqueue(new Uint8Array([1])); controller.close(); },
    cancel() { cancelado = true; },
  });
  const deps = dependencias(async () => new Response(corpo, { headers: { "content-type": "text/html" } }));
  const resposta = await publicar("a.lojas.avilaops.com", "/index.md", deps);
  assert.equal(resposta.status, 503);
  assert.equal(cancelado, true);
  assert.doesNotMatch(await resposta.text(), /\u0000/);
});

test("as famílias públicas de lojas e plataforma chegam à versão textual", async () => {
  const loja = ["/", "/produtos", "/produtos/item", "/categoria/pecas", "/sobre", "/contato", "/politicas/privacidade", "/promocoes", "/blog", "/blog/artigo", "/guias", "/guias/medidas", "/aplicacoes", "/aplicacoes/hidraulica", "/como-escolher", "/cotacao", "/cotacao-lote", "/configurador"];
  const plataforma = ["/", "/ajuda", "/marca", "/termos-comerciais", "/developers", "/developers/privacidade", "/blog", "/blog/artigo"];
  const deps = dependencias(async () => new Response(pagina("Página pública"), { headers: { "content-type": "text/html" } }));
  for (const [host, caminhos] of [["a.lojas.avilaops.com", loja], ["lojas.avilaops.com", plataforma]] as const) {
    for (const caminho of caminhos) {
      const texto = caminho === "/" ? "/index.md" : `${caminho}/index.md`;
      const resposta = await publicar(host, texto, deps);
      assert.equal(resposta.status, 200, `${host}${texto}`);
      assert.match(await resposta.text(), /# Página pública/);
    }
  }
});

test("llms acrescenta versões das páginas existentes e exclui links externos ou privados", async () => {
  const { adicionarDescobertaTexto } = await import("./publicacao-texto-rotas");
  const indice = "# Loja\n- [Produto](https://a.lojas.avilaops.com/produtos/item)\n- [Repetido](https://a.lojas.avilaops.com/produtos/item)\n- [Conta](https://a.lojas.avilaops.com/conta)\n- [Outra loja](https://b.lojas.avilaops.com/produtos/item)\n";
  const resultado = adicionarDescobertaTexto(indice, "https://a.lojas.avilaops.com", "loja");
  const descoberta = resultado.split("## Versões em Markdown e MDX")[1];
  assert.ok(descoberta);
  assert.match(descoberta, /https:\/\/a\.lojas\.avilaops\.com\/produtos\/item\/index\.md\)/);
  assert.match(descoberta, /https:\/\/a\.lojas\.avilaops\.com\/produtos\/item\/index\.mdx\)/);
  assert.equal(descoberta.split("/index.md)").length - 1, 1);
  assert.doesNotMatch(descoberta, /\/conta|b\.lojas/);
  assert.match(descoberta, /• Markdown/);
});

test("inventário de páginas exige cobertura pública ou exclusão operacional explícita", async () => {
  const { rotaPublicavel, lerCaminhoTexto } = await import("./publicacao-texto-rotas");
  const paginas: string[][] = [];
  function visitar(pasta: string, segmentos: string[]) {
    for (const item of readdirSync(pasta, { withFileTypes: true })) {
      if (item.isDirectory()) visitar(join(pasta, item.name), [...segmentos, item.name]);
      else if (/^page\.(?:tsx?|jsx?|mdx)$/.test(item.name)) paginas.push(segmentos);
    }
  }
  visitar("src/app", []);
  const cobertas = new Set<string>();
  for (const segmentos of paginas) {
    const publicos = segmentos.filter(segmento => !segmento.startsWith("("));
    const site = publicos[0] === "plataforma" ? "plataforma" : "loja";
    const partes = site === "plataforma" ? publicos.slice(1) : publicos;
    const caminho = "/" + partes.map(parte => parte.replace(/\[[^\]]+\]/g, "exemplo")).join("/");
    const excluida = site === "plataforma"
      ? /^\/(?:painel|entrar|criar|confirmar|autorizar|redefinir|recuperar)(?:\/|$)/.test(caminho)
      : /^\/(?:conta|pedido|carrinho|checkout|comparar|nao-encontrado)(?:\/|$)/.test(caminho);
    assert.equal(rotaPublicavel(caminho, site), !excluida, `${site}:${caminho} precisa de classificação de publicação`);
    if (!excluida) {
      const texto = caminho === "/" ? "/index.md" : `${caminho}/index.md`;
      assert.ok(lerCaminhoTexto(texto, site), `${site}:${texto}`);
      cobertas.add(`${site}:${caminho}`);
    }
  }
  assert.ok(cobertas.has("loja:/"));
  assert.ok(cobertas.has("plataforma:/"));
});
