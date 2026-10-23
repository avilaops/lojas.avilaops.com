import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import FiltrosProdutos from "@/components/FiltrosProdutos";

test("mobile mantém Filtrar e Ordenar na barra principal", () => {
  const html = renderToStaticMarkup(createElement(FiltrosProdutos, {
    categorias: [],
    valores: {},
  }));

  assert.match(html, /class="filtros-abrir"[^>]*>Filtrar<\/label>/);
  assert.match(html, /class="[^\"]*filtros-ordem-principal[^\"]*"/);
  assert.match(html, /value="relevancia"[^>]*>Ordenar<\/option>/);

  const inicioDosCampos = html.indexOf("filtros-campos");
  const ordem = html.indexOf("filtros-ordem-principal");
  assert.ok(ordem > 0 && ordem < inicioDosCampos, "a ordenação não pode ficar dentro da gaveta mobile");
});

test("categoria fixa usa a mesma barra compacta sem seletor de categoria", () => {
  const html = renderToStaticMarkup(createElement(FiltrosProdutos, {
    categorias: [],
    valores: { ordem: "menor-preco" },
    categoriaFixa: true,
  }));

  assert.match(html, />Menor preço<\/option>/);
  assert.doesNotMatch(html, /aria-label="Categoria"/);
  assert.equal((html.match(/name="ordem"/g) ?? []).length, 1);
});

test("limpar aparece somente quando existe estado ativo", () => {
  const vazio = renderToStaticMarkup(createElement(FiltrosProdutos, {
    categorias: [],
    valores: {},
  }));
  const busca = renderToStaticMarkup(createElement(FiltrosProdutos, {
    categorias: [],
    valores: { q: "6204" },
  }));

  assert.doesNotMatch(vazio, /Limpar busca e filtros/);
  assert.match(busca, /Limpar busca e filtros/);
  assert.doesNotMatch(busca, /id="filtros-mais"[^>]*checked/);
});

test("filtro secundário mantém a gaveta aberta e anuncia o estado", () => {
  const html = renderToStaticMarkup(createElement(FiltrosProdutos, {
    categorias: [],
    valores: { fabricante: "SKF" },
    fabricantes: [{ nome: "SKF", itens: 4, grafias: ["SKF"] }],
  }));

  assert.match(html, /id="filtros-mais"[^>]*checked/);
  assert.match(html, /Filtros ativos/);
  assert.match(html, /Limpar busca e filtros/);
});
