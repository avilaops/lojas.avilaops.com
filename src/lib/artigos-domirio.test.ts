import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { artigosDomiRio, artigoDomiRio, filtrarArtigosDomiRio, navegacaoArtigoDomiRio, temasDomiRio } from "./artigos-domirio";

test("coleção tem os 50 artigos ordenados e sete capas válidas", () => {
  const artigos = artigosDomiRio("domi-rio");
  assert.equal(artigos.length, 50);
  assert.equal(new Set(artigos.map(p => p.slug)).size, 50);
  assert.deepEqual(artigos.map(p => p.order), Array.from({ length: 50 }, (_, i) => i + 1));
  assert.equal(temasDomiRio.length, 7);
  assert.equal(new Set(artigos.map(p => p.cover)).size, 7);
  for (const p of artigos) {
    assert.match(p.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(p.title.length > 10 && p.description.length > 20);
    assert.doesNotMatch(`${p.title} ${p.description} ${p.category}`, /\uFFFD/);
    assert.ok(existsSync(path.join(process.cwd(), "public", p.cover)));
    const corpo = readFileSync(path.join(process.cwd(), "src/content/domirio/posts", p.slug + ".mdx"), "utf8");
    assert.doesNotMatch(corpo, /^---|^# /m);
    assert.match(corpo, /^## Fontes/m);
    assert.doesNotMatch(corpo, /\uFFFD/);
    assert.ok(p.sections.length >= 2);
    assert.equal(new Set(p.sections.map(s => s.id)).size, p.sections.length);
    assert.ok(p.readingMinutes >= 1);
  }
});

test("artigos estáticos não vazam entre lojas", () => {
  const slug = artigosDomiRio("domi-rio")[0].slug;
  for (const loja of ["bereta-rodas", "pkvedacoes", "", "domi-rio-falsa"]) {
    assert.deepEqual(artigosDomiRio(loja), []);
    assert.equal(artigoDomiRio(loja, slug), undefined);
  }
  assert.equal(artigoDomiRio("domi-rio", "artigo-inexistente"), undefined);
  assert.equal(artigoDomiRio("domi-rio", slug)?.slug, slug);
});

test("busca ignora acentos e combina assunto com consulta", () => {
  const todos = artigosDomiRio("domi-rio");
  assert.ok(filtrarArtigosDomiRio(todos, "receituario").some(p => p.order === 31));
  assert.ok(filtrarArtigosDomiRio(todos, "AGRONÔMICO").some(p => p.order === 31));
  assert.ok(filtrarArtigosDomiRio(todos, "", 2).every(p => p.series === 2));
  assert.equal(filtrarArtigosDomiRio(todos, "receituário", 2).length, 0);
  assert.equal(filtrarArtigosDomiRio(todos, "termoimpossivel").length, 0);
});

test("primeiro e último artigos têm navegação sem links inexistentes", () => {
  const artigos = artigosDomiRio("domi-rio");
  const primeiro = navegacaoArtigoDomiRio(artigos[0].slug);
  const ultimo = navegacaoArtigoDomiRio(artigos[49].slug);
  assert.equal(primeiro.anterior, undefined);
  assert.equal(primeiro.proximo?.order, 2);
  assert.equal(ultimo.anterior?.order, 49);
  assert.equal(ultimo.proximo, undefined);
  assert.ok(primeiro.relacionados.every(p => p.series === 1 && p.order !== 1));
  assert.deepEqual(navegacaoArtigoDomiRio("inexistente"), { relacionados: [] });
});

test("mapa MDX tem uma importação explícita para cada slug", () => {
  const mapa = readFileSync(path.join(process.cwd(), "src/content/domirio/carregar.ts"), "utf8");
  for (const p of artigosDomiRio("domi-rio")) assert.ok(mapa.includes(`import("./posts/${p.slug}.mdx")`));
});
