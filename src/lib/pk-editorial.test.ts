import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import test from "node:test";
import { EDITORIAL_PK, listarEditorialPk, acharEditorialPk, caminhosEditorialPk } from "./pk-editorial";

test("editorial PK tem seis guias e dez segmentos sem exposição em outro tenant", () => {
  assert.equal(listarEditorialPk("pkvedacoes", "guias").length, 6);
  assert.equal(listarEditorialPk("pkvedacoes", "aplicacoes").length, 10);
  assert.deepEqual(listarEditorialPk("domi-rio"), []);
  assert.deepEqual(caminhosEditorialPk("outra-loja"), []);
  assert.equal(acharEditorialPk("outra-loja", "guias", "medir-vedacoes"), undefined);
  assert.equal(acharEditorialPk("pkvedacoes", "guias", "../medir-vedacoes"), undefined);
  assert.equal(acharEditorialPk("pkvedacoes", "guias", "agricultura"), undefined);
  assert.equal(new Set(caminhosEditorialPk("pkvedacoes")).size, 18);
});

test("cada entrada tem corpo substantivo, import literal e links conhecidos", () => {
  const carregador = readFileSync("src/content/pkvedacoes/editorial.ts", "utf8");
  const categorias = new Set(["gaxeta-pu-tipo-b", "gaxeta-pu-tipo-std", "gaxeta-pu-tipo-bs", "raspador-pu-tipo-d", "anel-guia"]);
  assert.equal(new Set(EDITORIAL_PK.map(item => item.slug)).size, EDITORIAL_PK.length);
  for (const item of EDITORIAL_PK) {
    assert.match(item.slug, /^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    assert.ok(item.titulo && item.resumo && item.familias.length);
    const arquivo = `src/content/pkvedacoes/${item.tipo}/${item.slug}.mdx`;
    assert.ok(existsSync(arquivo), arquivo);
    assert.ok(carregador.includes(`import("./${item.tipo}/${item.slug}.mdx")`));
    const corpo = readFileSync(arquivo, "utf8");
    assert.ok(corpo.split(/\s+/).length >= 200, item.slug);
    assert.doesNotMatch(corpo, /agel/i);
    assert.ok(corpo.includes("](/cotacao-lote)"), item.slug);
    for (const link of corpo.matchAll(/\]\((\/[^)]+)\)/g)) {
      const href = link[1];
      assert.ok(href === "/cotacao-lote" || caminhosEditorialPk("pkvedacoes").includes(href) || (href.startsWith("/categoria/") && categorias.has(href.slice(11))), href);
    }
  }
});

test("índices e artigos bloqueiam tenant alheio e usam canônico próprio", () => {
  for (const tipo of ["guias", "aplicacoes"]) {
    for (const trecho of ["page.tsx", "[slug]/page.tsx"]) {
      const rota = readFileSync(`src/app/${tipo}/${trecho}`, "utf8");
      assert.ok(rota.includes('t.slug !== "pkvedacoes"'));
      assert.ok(rota.includes("notFound()"));
      assert.ok(rota.includes(`canonical: ${trecho === "page.tsx" ? '"' : '`'}/${tipo}`));
    }
  }
});
