import assert from "node:assert/strict";
import test from "node:test";
import { dadosDaHomeIndustrial, urlDaBuscaPorMedida } from "./home-industrial";

test("mantém as seis famílias prioritárias na ordem recebida", () => {
  const categorias = Array.from({ length: 8 }, (_, indice) => ({
    id: `cat-${indice}`,
    slug: `familia-${indice}`,
    nome: `Família ${indice}`,
  }));

  assert.deepEqual(
    dadosDaHomeIndustrial(categorias, []).categorias.map((categoria) => categoria.id),
    ["cat-0", "cat-1", "cat-2", "cat-3", "cat-4", "cat-5"],
  );
});

test("remove marcas vazias e repetidas sem alterar a primeira grafia", () => {
  const resultado = dadosDaHomeIndustrial([], [" SKF ", "", "skf", "Sabó", "  ", "Corteco"]);

  assert.deepEqual(resultado.marcas, ["SKF", "Sabó", "Corteco"]);
});

test("limita a faixa a doze marcas confirmadas", () => {
  const marcas = Array.from({ length: 15 }, (_, indice) => `Marca ${indice + 1}`);
  assert.equal(dadosDaHomeIndustrial([], marcas).marcas.length, 12);
});

test("monta a URL dimensional com tolerância de meio milímetro", () => {
  assert.equal(
    urlDaBuscaPorMedida({ di: "50,8", de: "63.5", alt: "9,52" }),
    "/produtos?di_de=50.3&di_ate=51.3&de_de=63&de_ate=64&alt_de=9.02&alt_ate=10.02",
  );
});

test("ignora entradas dimensionais vazias ou inválidas e rejeita busca sem medida", () => {
  assert.equal(urlDaBuscaPorMedida({ di: "0", de: "texto", alt: "" }), null);
  assert.equal(urlDaBuscaPorMedida({ di: "25", de: "texto", alt: "" }), "/produtos?di_de=24.5&di_ate=25.5");
});
