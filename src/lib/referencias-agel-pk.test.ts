import assert from "node:assert/strict";
import test from "node:test";
import { condicoesBuscaAgelPk, referenciaAgelPk } from "./referencias-agel-pk";
import dados from "../content/pkvedacoes/referencias-agel.json";

const produto = {
  slug: "gny-5030-w2-3250-500",
  atributos: { diametroInternoMm: 76.2, diametroExternoMm: 82.55, secaoMm: 3.17, alturaMm: 12.7, referencia: "W2-3250.500", material: "Nylon com fibra de vidro" },
};

test("34 relações documentadas preservam página, edição e hash e funcionam pela mesma regra", () => {
  assert.equal(dados.referencias.length, 34);
  assert.equal(new Set(dados.referencias.map(r => r.slug)).size, 34);
  assert.equal(dados.fonte.edicao, "02/2019");
  assert.match(dados.fonte.sha256, /^[a-f0-9]{64}$/);
  for (const r of dados.referencias) {
    assert.ok(r.pagina >= 4 && r.pagina <= 10);
    assert.equal(referenciaAgelPk("pkvedacoes", { slug: r.slug, atributos: { ...r, referencia: r.referenciaPk, material: "Nylon com fibra de vidro" } })?.codigoAgel, r.codigoAgel);
    assert.equal(condicoesBuscaAgelPk(`AGEL ${r.codigoAgel}`)[0]?.slug, r.slug);
  }
});

test("referência Agel exige loja PK, identidade e todas as medidas documentadas", () => {
  assert.equal(referenciaAgelPk("pkvedacoes", produto)?.codigoAgel, "5721");
  assert.equal(referenciaAgelPk("vedashow", produto), null);
  assert.equal(referenciaAgelPk("pkvedacoes", { ...produto, slug: "outro" }), null);
  for (const campo of ["diametroInternoMm", "diametroExternoMm", "secaoMm", "alturaMm", "referencia", "material"]) {
    assert.equal(referenciaAgelPk("pkvedacoes", { ...produto, atributos: { ...produto.atributos, [campo]: 999 } }), null, campo);
  }
});

test("cadastro modificado perde a associação e não publica material ou medidas presumidos", () => {
  assert.equal(referenciaAgelPk("pkvedacoes", { ...produto, atributos: { ...produto.atributos, material: "PTFE" } }), null);
  assert.equal(referenciaAgelPk("pkvedacoes", { ...produto, atributos: { ...produto.atributos, alturaMm: "12.70" } }), null);
  assert.equal(referenciaAgelPk("pkvedacoes", { ...produto, atributos: { ...produto.atributos, referencia: "W2 3250 500" } }), null);
});

test("busca aceita código Agel completo e mantém isolamento por tenant e medidas", () => {
  for (const consulta of ["5721", "AGEL 5721", "agel-5721", "AGEL.5721"]) {
    const [condicao] = condicoesBuscaAgelPk(consulta);
    assert.equal(condicao.slug, produto.slug);
    assert.deepEqual(condicao.tenant, { slug: "pkvedacoes" });
    assert.ok(Array.isArray(condicao.AND) && condicao.AND.length >= 4);
  }
  assert.deepEqual(condicoesBuscaAgelPk("1208"), []); // referência com medidas divergentes
  assert.deepEqual(condicoesBuscaAgelPk("572"), []); // não transforma parte do código em alias
  assert.deepEqual(condicoesBuscaAgelPk("gaxeta BS"), []);
});

test("medidas textuais do JSON conservam o mesmo valor nominal", () => {
  const atributos = Object.fromEntries(Object.entries(produto.atributos).map(([k, v]) => [k, String(v)]));
  assert.equal(referenciaAgelPk("pkvedacoes", { ...produto, atributos })?.codigoAgel, "5721");
});
