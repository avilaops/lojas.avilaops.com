import assert from "node:assert/strict";
import test from "node:test";
import { seoCategoriaFallback } from "./seo-categorias";

test("gera SEO de motopeças apenas com marcas e motos informadas", () => {
  const seo = seoCategoriaFallback({
    loja: "Moto Centro",
    segmento: "motopecas",
    categoria: "Freios",
    descricaoAtual: null,
    marcas: ["Cobreq", "Fischer"],
    motos: ["Honda CG 160", "Yamaha Fazer 250"],
  });

  assert.equal(seo.titulo, "Freios");
  assert.match(seo.descricao, /Honda CG 160/);
  assert.match(seo.descricao, /Cobreq/);
  assert.ok(seo.descricao.length >= 40 && seo.descricao.length <= 170);
  assert.deepEqual(seo.palavrasChave.slice(0, 3), ["Freios", "Cobreq", "Fischer"]);
  assert.doesNotMatch(seo.descricao, /garantia|frete grátis|melhor preço/i);
});

test("normaliza descrição e nome curtos sem quebrar o contrato público", () => {
  const seo = seoCategoriaFallback({
    loja: "Loja A",
    segmento: "geral",
    categoria: "X",
    descricaoAtual: "Peças.",
    marcas: [],
    motos: [],
  });

  assert.equal(seo.titulo, "Categoria X");
  assert.ok(seo.descricao.length >= 40 && seo.descricao.length <= 170);
  assert.ok(seo.palavrasChave.every((termo) => termo.length >= 2));
});

test("remove duplicidade de termos sem alterar a grafia original", () => {
  const seo = seoCategoriaFallback({
    loja: "Moto Centro",
    segmento: "motopecas",
    categoria: "Relação",
    descricaoAtual: null,
    marcas: ["DID", "did", "Vaz"],
    motos: ["Honda CB 300", "honda cb 300"],
  });

  assert.equal(seo.palavrasChave.filter((termo) => termo.toLowerCase() === "did").length, 1);
  assert.equal(seo.palavrasChave.filter((termo) => termo.toLowerCase() === "honda cb 300").length, 1);
});
