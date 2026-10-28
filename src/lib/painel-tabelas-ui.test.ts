import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const ler = (caminho: string) => readFileSync(new URL(caminho, import.meta.url), "utf8");

const catalogo = ler("../components/painel/CatalogoLista.tsx");
const lista = ler("../components/aplicacao/ListaDeRegistros.tsx");
const fiscal = ler("../components/painel/Fiscal.tsx");
const painelCss = ler("../app/plataforma/(admin)/painel.css");

test("catálogo usa a apresentação compacta de planilha", () => {
  assert.match(lista, /estilo\?: "lista" \| "planilha"/);
  assert.match(catalogo, /estilo="planilha"/);
});

test("catálogo consolida problemas de cadastro em uma coluna de pendências", () => {
  assert.match(catalogo, /rotulo: "Pendências"/);
  assert.match(catalogo, /pendenciasDoProduto/);
});

test("catálogo explica estoque sem controle em vez de usar o símbolo de infinito", () => {
  assert.match(catalogo, /Estoque não controlado/);
  assert.doesNotMatch(catalogo, /\? "∞"/);
});

test("planilha mantém o cabeçalho visível durante a rolagem", () => {
  assert.match(lista, /sticky top-0/);
});

test("tabela fiscal escolhe cartões ou planilha pela largura real do conteúdo", () => {
  assert.match(fiscal, /fiscal-tabela-responsiva/);
  assert.match(fiscal, /fiscal-tabela-cartoes/);
  assert.match(fiscal, /fiscal-tabela-planilha/);
  assert.match(painelCss, /\.fiscal-tabela-responsiva\s*\{[^}]*container-type:\s*inline-size/s);
  assert.match(painelCss, /@container\s*\(min-width:/);
});

test("notas fiscais nomeiam a data e agrupam identificação do fornecedor", () => {
  assert.match(fiscal, /Data de emissão/);
  assert.match(fiscal, />Fornecedor</);
  assert.match(fiscal, /documentoFormatado\(doc\.documentoFornecedor\)/);
});

test("situação fiscal importante não é cortada com reticências", () => {
  assert.match(fiscal, /whitespace-normal[^"`]*break-words/);
  assert.doesNotMatch(fiscal, /block truncate rounded-full/);
});
