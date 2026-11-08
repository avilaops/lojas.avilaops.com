import assert from "node:assert/strict";
import test from "node:test";
import { condicoesBuscaAgelPk, referenciaAgelPk } from "./referencias-agel-pk";

const produto = {
  slug: "gny-5030-w2-3250-500",
  atributos: { diametroInternoMm: 76.2, diametroExternoMm: 82.55, secaoMm: 3.17, alturaMm: 12.7, referencia: "W2-3250.500" },
};

test("referÃªncia Agel exige loja PK, identidade e todas as medidas documentadas", () => {
  assert.equal(referenciaAgelPk("pkvedacoes", produto)?.codigoAgel, "5721");
  assert.equal(referenciaAgelPk("vedashow", produto), null);
  assert.equal(referenciaAgelPk("pkvedacoes", { ...produto, slug: "outro" }), null);
  for (const campo of ["diametroInternoMm", "diametroExternoMm", "secaoMm", "alturaMm", "referencia"]) {
    assert.equal(referenciaAgelPk("pkvedacoes", { ...produto, atributos: { ...produto.atributos, [campo]: 999 } }), null, campo);
  }
});

test("busca aceita cÃ³digo Agel completo e mantÃ©m isolamento por tenant e medidas", () => {
  for (const consulta of ["5721", "AGEL 5721", "agel-5721", "AGEL.5721"]) {
    const [condicao] = condicoesBuscaAgelPk(consulta);
    assert.equal(condicao.slug, produto.slug);
    assert.deepEqual(condicao.tenant, { slug: "pkvedacoes" });
    assert.ok(Array.isArray(condicao.AND) && condicao.AND.length >= 4);
  }
  assert.deepEqual(condicoesBuscaAgelPk("1208"), []); // referÃªncia com medidas divergentes
  assert.deepEqual(condicoesBuscaAgelPk("572"), []); // nÃ£o transforma parte do cÃ³digo em alias
  assert.deepEqual(condicoesBuscaAgelPk("gaxeta BS"), []);
});

test("medidas textuais do JSON conservam o mesmo valor nominal", () => {
  const atributos = Object.fromEntries(Object.entries(produto.atributos).map(([k, v]) => [k, String(v)]));
  assert.equal(referenciaAgelPk("pkvedacoes", { ...produto, atributos })?.codigoAgel, "5721");
});

