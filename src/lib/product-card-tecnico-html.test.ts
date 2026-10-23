import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Produto, Tenant } from "@prisma/client";
import ProductCard from "@/components/ProductCard";

const loja = {
  id: "loja",
  slug: "catalogo-tecnico",
  nome: "Catálogo técnico",
  tema: { layout: "industrial" },
  dominioPrincipal: null,
  estoqueBaixoEm: 3,
} as unknown as Tenant;

const produto = (atributos: Record<string, unknown>) => ({
  id: "produto",
  tenantId: loja.id,
  categoriaId: null,
  slug: "rolamento-6204",
  nome: "Rolamento 6204 2RS",
  marca: "SKF",
  sku: "6204-2RS",
  gtin: null,
  precoCentavos: 4590,
  precoDeCentavos: null,
  imagens: [],
  imagemOrigem: "propria",
  destaque: false,
  ativo: true,
  disponibilidade: "out_of_stock",
  estoque: 0,
  atributos,
  compatibilidade: [],
  opcoes: [],
  codigosEquivalentes: [],
  tarja: "nenhuma",
} as unknown as Produto);

test("card técnico publica vedação e unidade cadastradas", () => {
  const html = renderToStaticMarkup(createElement(ProductCard, {
    produto: produto({
      diametroInternoMm: 20,
      diametroExternoMm: 47,
      larguraMm: 14,
      vedacao: "2RS",
      unidade: "UN",
    }),
    loja,
    vende: false,
    whatsapp: null,
  }));

  assert.match(html, /Vedação<\/dt><dd>2RS<\/dd>/);
  assert.match(html, /Venda: UN/);
});

test("card técnico não inventa unidade ausente", () => {
  const html = renderToStaticMarkup(createElement(ProductCard, {
    produto: produto({ diametroInternoMm: 20, dureza: "70 Shore A" }),
    loja,
    vende: false,
    whatsapp: null,
  }));

  assert.match(html, /Dureza<\/dt><dd>70 Shore A<\/dd>/);
  assert.doesNotMatch(html, /Venda:/);
});
