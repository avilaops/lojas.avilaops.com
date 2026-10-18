import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import FiltrosProdutos from "../components/FiltrosProdutos";
import AjudaCatalogo from "../components/AjudaCatalogo";

function filtros(valores: Record<string, string | undefined>) {
  return renderToStaticMarkup(createElement(FiltrosProdutos, { categorias: [], valores }));
}

test("catálogo sem filtro não oferece limpeza e mantém o formulário GET", () => {
  const html = filtros({});
  assert.doesNotMatch(html, /Limpar busca e filtros/);
  assert.match(html, /action="\/produtos"/);
  assert.doesNotMatch(html, /method="post"/);
});

test("buscar pelo nome preserva a consulta sem expandir filtros secundários", () => {
  const html = filtros({ q: "retentor 20x35x7" });
  assert.match(html, /value="retentor 20x35x7"/);
  assert.match(html, /Limpar busca e filtros/);
  assert.doesNotMatch(html, /checked=""/);
});

test("filtro de preço ativo continua visível após a navegação", () => {
  const html = filtros({ min: "12,50" });
  assert.match(html, /checked=""/);
  assert.match(html, /Filtros e ordem · ativos/);
  assert.match(html, /value="12,50"/);
});

test("faixa dimensional ativa mantém os valores e o seletor aberto", () => {
  const html = renderToStaticMarkup(createElement(FiltrosProdutos, {
    categorias: [], valores: { di_de: "20,5" },
    medidas: [{ campo: "diametroInternoMm", rotulo: "Diâmetro interno", min: 10, max: 50, itens: 20 }],
  }));
  assert.match(html, /<details open=""/);
  assert.match(html, /name="di_de"[^>]*value="20,5"/);
});

test("atendimento usa o WhatsApp da loja e preserva a identificação pesquisada", () => {
  const html = renderToStaticMarkup(createElement(AjudaCatalogo, {
    whatsapp: "551634413180", categoria: "Retentores", tecnico: true,
    valores: { q: "BA 20x35x7", di_de: "20", di_ate: "20", perfil: "BA" },
  }));
  assert.match(html, /Precisa de ajuda para identificar a peça/);
  const href = /href="([^"]+)"/.exec(html)![1].replaceAll("&amp;", "&");
  const url = new URL(href);
  assert.equal(url.pathname, "/551634413180");
  const mensagem = url.searchParams.get("text")!;
  assert.match(mensagem, /Categoria: Retentores/);
  assert.match(mensagem, /Busca: BA 20x35x7/);
  assert.match(mensagem, /Diâmetro interno mínimo: 20 mm/);
  assert.match(mensagem, /Perfil: BA/);
});

test("loja sem medidas recebe linguagem genérica e sem canal não exibe atalho", () => {
  const props = { whatsapp: "5517999990000", tecnico: false, valores: {} };
  const html = renderToStaticMarkup(createElement(AjudaCatalogo, props));
  assert.match(html, /ajuda para escolher/);
  assert.doesNotMatch(html, /identificar a peça/);
  assert.equal(renderToStaticMarkup(createElement(AjudaCatalogo, { ...props, whatsapp: null })), "");
});
