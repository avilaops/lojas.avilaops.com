import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { converterHtml } from "@avilaops/publicacao-texto";
import { prisma } from "../../src/lib/db.ts";
import { salvarProdutoNoCatalogo } from "../../src/lib/catalogo-escrita.ts";

/** Exercita o build real já iniciado pela jornada, somente no banco isolado. */
export async function verificarPublicacaoTextoHttp(servidor: string, tenantId: string, pasta: string) {
  const banco = new URL(process.env.DATABASE_URL ?? "http://invalid");
  const origem = new URL(servidor);
  assert.equal(process.env.CI, "true");
  assert.ok(["127.0.0.1", "localhost"].includes(banco.hostname) && banco.port === "5548" && banco.pathname.endsWith("_test"));
  assert.ok(origem.protocol === "http:" && origem.hostname === "127.0.0.1" && origem.port === "3097");
  const primeira = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  assert.match(primeira.slug, /^qa-browser-/);
  assert.equal(primeira.dominioPrincipal, "localhost");
  const id = randomUUID();
  const hostB = `texto-${id}.example.test`;
  const alias = `alias-${id}.example.test`;
  const segunda = await prisma.tenant.create({ data: { slug: `qa-texto-${id}`, nome: "Loja QA de texto", status: "ATIVA", dominios: [hostB, alias], dominioPrincipal: hostB, loginEmail: `${id}@example.test` } });
  const slug = `publicacao-${id}`;
  const a = await salvarProdutoNoCatalogo(primeira.id, null, { nome: "Texto público A", slug, sku: `A-${id}`, precoCentavos: 1700, estoque: 5, imagens: [] });
  await salvarProdutoNoCatalogo(segunda.id, null, { nome: "Texto público B", slug, sku: `B-${id}`, precoCentavos: 2300, estoque: 5, imagens: [] });
  const obter = (host: string, caminho: string, etag?: string) => fetch(new URL(caminho, origem), {
    redirect: "manual", cache: "no-store", signal: AbortSignal.timeout(30_000),
    headers: { host, "x-forwarded-host": host, ...(etag ? { "if-none-match": etag } : {}) },
  });
  const conferir = async (resposta: Response, titulo: string, formato: string) => {
    assert.equal(resposta.status, 200, `Representação ${formato} precisa sair do renderizador real.`);
    assert.match(resposta.headers.get("content-type") ?? "", new RegExp(`^text/${formato}(?:;|$)`));
    assert.match(resposta.headers.get("cache-control") ?? "", /\bno-store\b/);
    assert.match(resposta.headers.get("x-robots-tag") ?? "", /\bnoindex\b/);
    const corpo = await resposta.text();
    assert.ok(corpo.includes(titulo));
    assert.ok(resposta.headers.get("etag"));
    return corpo;
  };
  const html = await obter("127.0.0.1", "/developers/privacidade");
  assert.equal(html.status, 200);
  assert.match(html.headers.get("link") ?? "", /\/developers\/privacidade\/index\.md/);
  const htmlPlataforma = await html.text();
  const convertido = converterHtml(htmlPlataforma, { url: "https://127.0.0.1/developers/privacidade", formato: "md" });
  assert.equal(convertido.indexavel, true, `HTML real da plataforma recusado pelo conversor: ${convertido.motivo}.`);
  const plataforma = await obter("127.0.0.1", "/developers/privacidade/index.md");
  if (plataforma.status !== 200) {
    const direta = await obter("127.0.0.1", "/api/publicacao-texto?caminho=%2Fdevelopers%2Fprivacidade%2Findex.md");
    assert.fail(`Publicação HTTP da plataforma recusada • via proxy ${plataforma.status} • via API ${direta.status} • HTML indexável ${convertido.indexavel}.`);
  }
  await conferir(plataforma, "conector", "markdown");
  const caminho = `/produtos/${slug}/index.md`;
  const textoA = await obter("localhost", caminho);
  const etagA = textoA.headers.get("etag")!;
  assert.doesNotMatch(await conferir(textoA, "Texto público A", "markdown"), /Texto público B/);
  const textoB = await obter(hostB, caminho);
  assert.doesNotMatch(await conferir(textoB, "Texto público B", "markdown"), /Texto público A/);
  assert.notEqual(etagA, textoB.headers.get("etag"));
  await conferir(await obter(hostB, `/produtos/${slug}/index.mdx`), "Texto público B", "mdx");
  const igual = await obter("localhost", caminho, etagA);
  assert.equal(igual.status, 304);
  assert.equal(await igual.text(), "");
  assert.equal((await prisma.produto.updateMany({ where: { id: a.id, tenantId: primeira.id }, data: { nome: "Texto público A atualizado" } })).count, 1);
  const atualizado = await obter("localhost", caminho, etagA);
  await conferir(atualizado, "Texto público A atualizado", "markdown");
  assert.notEqual(atualizado.headers.get("etag"), etagA);
  assert.equal((await prisma.produto.updateMany({ where: { id: a.id, tenantId: primeira.id }, data: { ativo: false } })).count, 1);
  assert.equal((await obter("localhost", caminho, etagA)).status, 404);
  await conferir(await obter(hostB, caminho), "Texto público B", "markdown");
  assert.equal((await obter(alias, caminho)).status, 404, "Alias noindex não deve oferecer exportação.");
  assert.equal((await obter("fora.example.test", caminho)).status, 404);
  for (const privado of ["/checkout/index.md", "/conta/index.md", "/%63onta/index.md", "/%2570ainel/index.mdx"]) {
    assert.equal((await obter("localhost", privado)).status, 404, privado);
  }
  const indice = await obter("127.0.0.1", "/llms.txt");
  assert.equal(indice.status, 200);
  assert.match(await indice.text(), /\/index\.md\)/);
  await writeFile(`${pasta}/publicacao-texto-summary.json`, JSON.stringify({
    status: "passed", environment: "github-ci-isolated", runtime: "next-standalone", sha: process.env.GITHUB_SHA,
    checks: { platform: true, twoTenantsSameSlug: true, markdownAndMdx: true, htmlAndLlmsDiscovery: true, noStore: true, noindex: true, etagReadback: true, update: true, removal: true, privateEncodedPaths: true, unknownHost: true },
    productionBackendValidated: false,
  }, null, 2));
  console.log("Publicação textual • HTTP do build Next, isolamento, atualização e remoção aprovados na CI.");
}
