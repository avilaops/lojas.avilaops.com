import assert from "node:assert/strict";
import test from "node:test";
import { indiceDeSitemaps, lojasDoIndice } from "./sitemap-lojas";

const BASE = "lojas.avilaops.com";

test("índice aponta para o sitemap de cada loja no subdomínio", () => {
  const xml = indiceDeSitemaps(BASE, [
    { slug: "demo", dominioPrincipal: null },
    { slug: "casa-da-ana", dominioPrincipal: null },
  ]);
  assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n<sitemapindex /);
  assert.ok(xml.includes("<sitemap><loc>https://demo.lojas.avilaops.com/sitemap.xml</loc></sitemap>"));
  assert.ok(xml.includes("<sitemap><loc>https://casa-da-ana.lojas.avilaops.com/sitemap.xml</loc></sitemap>"));
});

test("loja com domínio próprio fica fora: o subdomínio dela é noindex", () => {
  const xml = indiceDeSitemaps(BASE, [
    { slug: "vedashow", dominioPrincipal: "vedashow.com.br" },
    { slug: "demo", dominioPrincipal: null },
  ]);
  assert.ok(!xml.includes("vedashow"));
  assert.ok(xml.includes("demo.lojas.avilaops.com"));
});

test("domínio principal vazio conta como sem domínio próprio", () => {
  assert.equal(lojasDoIndice([{ slug: "demo", dominioPrincipal: "" }]).length, 1);
});

test("slug que quebraria o XML ou o host não entra", () => {
  assert.equal(lojasDoIndice([{ slug: "a<b", dominioPrincipal: null }, { slug: "a.b", dominioPrincipal: null }]).length, 0);
});

test("sem loja o índice continua XML válido", () => {
  assert.equal(
    indiceDeSitemaps(BASE, []),
    `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n</sitemapindex>\n`,
  );
});
