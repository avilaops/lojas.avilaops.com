import assert from "node:assert/strict";
import test from "node:test";
import { montarTrilha } from "./trilha-automotiva";

/** As sete categorias reais da Brilhax, que foi o caso que originou o layout. */
const BRILHAX = [
  { id: "1", slug: "lavagem", nome: "Lavagem" },
  { id: "2", slug: "polimento", nome: "Polimento" },
  { id: "3", slug: "vitrificacao", nome: "Vitrificação" },
  { id: "4", slug: "protecao", nome: "Proteção" },
  { id: "5", slug: "acessorios", nome: "Acessórios" },
  { id: "6", slug: "kits", nome: "Kits Completos" },
  { id: "7", slug: "moto", nome: "Produtos para Moto" },
];

test("monta a trilha na ordem do serviço, não na ordem do cadastro", () => {
  const { trilha, mostrar } = montarTrilha(BRILHAX);
  assert.equal(mostrar, true);
  assert.deepEqual(trilha.map((p) => p.chave), ["lavar", "corrigir", "proteger"]);
  assert.deepEqual(trilha.map((p) => p.categoria.slug), ["lavagem", "polimento", "vitrificacao"]);
});

test("uma categoria não aparece em duas etapas", () => {
  // "Cera de polimento" casa com Corrigir (polimento) e com Proteger (cera).
  const { trilha } = montarTrilha([
    { id: "1", slug: "lavagem", nome: "Lavagem" },
    { id: "2", slug: "cera-polimento", nome: "Cera de polimento" },
  ]);
  const slugs = trilha.map((p) => p.categoria.slug);
  assert.equal(new Set(slugs).size, slugs.length);
  // Vence a etapa que vem antes no processo.
  assert.deepEqual(trilha.map((p) => p.chave), ["lavar", "corrigir"]);
});

test("o que não é etapa sobra para a grade de categorias", () => {
  const { restantes } = montarTrilha(BRILHAX);
  assert.deepEqual(restantes.map((c) => c.slug), ["protecao", "acessorios", "kits", "moto"]);
});

test("com uma etapa só, não mostra trilha e devolve todas as categorias", () => {
  // Autopeças que usa o layout pelo resto: não pode ficar com meia seção na
  // primeira tela.
  const autopecas = [
    { id: "1", slug: "freios", nome: "Freios" },
    { id: "2", slug: "suspensao", nome: "Suspensão" },
    { id: "3", slug: "lavagem", nome: "Lavagem" },
  ];
  const { mostrar, restantes } = montarTrilha(autopecas);
  assert.equal(mostrar, false);
  assert.equal(restantes.length, 3);
});

test("loja sem nenhuma etapa reconhecida não quebra", () => {
  const { trilha, mostrar, restantes } = montarTrilha([
    { id: "1", slug: "camisetas", nome: "Camisetas" },
  ]);
  assert.equal(trilha.length, 0);
  assert.equal(mostrar, false);
  assert.equal(restantes.length, 1);
});

test("reconhece o vocabulário do ramo, não só o nome exato", () => {
  const { trilha } = montarTrilha([
    { id: "1", slug: "shampoo", nome: "Shampoo automotivo" },
    { id: "2", slug: "clay", nome: "Clay bar e descontaminação" },
    { id: "3", slug: "boinas", nome: "Boinas e espumas" },
    { id: "4", slug: "coating", nome: "Coating cerâmico" },
  ]);
  assert.deepEqual(trilha.map((p) => p.chave), ["lavar", "descontaminar", "corrigir", "proteger"]);
});

test("catálogo vazio devolve trilha vazia", () => {
  const { trilha, mostrar, restantes } = montarTrilha([]);
  assert.equal(trilha.length, 0);
  assert.equal(mostrar, false);
  assert.equal(restantes.length, 0);
});
