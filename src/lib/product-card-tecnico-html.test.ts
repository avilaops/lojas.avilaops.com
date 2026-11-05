import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Produto, Tenant } from "@prisma/client";
import ProductCard from "@/components/ProductCard";
import TabelaTecnica from "@/components/TabelaTecnica";

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

test("selo de estoque baixo usa texto escuro sobre o âmbar", () => {
  const html = renderToStaticMarkup(createElement(ProductCard, {
    produto: { ...produto({}), disponibilidade: "in_stock", estoque: 2 },
    loja,
    vende: false,
    whatsapp: null,
  }));
  assert.match(html, /bg-amber-500[^\"]*text-zinc-950/);
  assert.doesNotMatch(html, /bg-amber-500[^\"]*text-white/);
});

test("card e tabela não oferecem pedido assistido quando o WhatsApp é inválido", () => {
  for (const whatsapp of ["ligue 1634413180", "https://wa.me/551634413180", "0000000000", "   "]) {
    for (const precoCentavos of [0, 4590]) {
      const p = { ...produto({}), disponibilidade: "in_stock", estoque: 3, precoCentavos } as Produto;
      const card = renderToStaticMarkup(createElement(ProductCard, { produto: p, loja, vende: false, whatsapp }));
      assert.doesNotMatch(card, /acao-whatsapp|Consultar preço<|Adicionar ao pedido|Pedir pelo WhatsApp/, whatsapp);
      const tabela = renderToStaticMarkup(createElement(TabelaTecnica, {
        produtos: [p], loja: { ...loja, whatsapp }, vende: false, titulo: "Peças", nomeDaLoja: loja.nome,
      }));
      assert.doesNotMatch(tabela, /wa.me|>Consultar<|Adicionar ao pedido/, whatsapp);
      assert.match(tabela, /href="\/produtos\/rolamento-6204"/);
    }
  }
});

test("card e tabela sob consulta usam o mesmo destino nacional e internacional", () => {
  for (const [whatsapp, destino] of [["(16) 3441-3180", "551634413180"], ["+1 202 555 0123", "12025550123"]]) {
    const p = { ...produto({}), disponibilidade: "in_stock", estoque: 3, precoCentavos: 0 } as Produto;
    const card = renderToStaticMarkup(createElement(ProductCard, { produto: p, loja, vende: false, whatsapp }));
    const tabela = renderToStaticMarkup(createElement(TabelaTecnica, {
      produtos: [p], loja: { ...loja, whatsapp }, vende: false, titulo: "Peças", nomeDaLoja: loja.nome,
    }));
    const hrefEsperado = `href="https://wa.me/${destino}?text=`;
    assert.ok(card.includes(hrefEsperado), whatsapp);
    assert.ok(tabela.includes(hrefEsperado), whatsapp);
    assert.match(card, /Consultar preço/);
    assert.match(tabela, />Consultar</);
  }
});
