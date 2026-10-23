import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SeletorTecnicoFamilia from "@/components/SeletorTecnicoFamilia";
import { configuracaoBuscaTecnica } from "./busca-tecnica-familia";

const medidas = [
  { campo: "diametroInternoMm" as const, rotulo: "Diâmetro interno", min: 10, max: 100, itens: 20 },
  { campo: "diametroExternoMm" as const, rotulo: "Diâmetro externo", min: 20, max: 120, itens: 20 },
  { campo: "alturaMm" as const, rotulo: "Altura", min: 2, max: 20, itens: 20 },
  { campo: "secaoMm" as const, rotulo: "Seção do cordão", min: 1, max: 8, itens: 20 },
  { campo: "comprimentoMm" as const, rotulo: "Comprimento", min: 500, max: 2000, itens: 20 },
];

test("O-ring mostra apenas interno, seção, material e dureza", () => {
  const html = renderToStaticMarkup(createElement(SeletorTecnicoFamilia, {
    configuracao: configuracaoBuscaTecnica("O-Rings")!,
    medidas,
    valores: {},
    facetas: { material: ["NBR"], dureza: ["70 Shore A"], vedacao: [] },
  }));
  assert.match(html, /Como medir um O-ring/);
  assert.match(html, /name="di_de"/);
  assert.match(html, /name="sec_de"/);
  assert.match(html, /name="material"/);
  assert.match(html, /name="dureza"/);
  assert.match(html, /name="material"[^>]*aria-label="Material"/);
  assert.match(html, /name="dureza"[^>]*aria-label="Dureza"/);
  assert.doesNotMatch(html, /name="de_de"|name="alt_de"|name="vedacao"/);
  assert.match(html, /não confirma compatibilidade/);
});

test("correia explica a referência e filtra perfil e comprimento", () => {
  const html = renderToStaticMarkup(createElement(SeletorTecnicoFamilia, {
    configuracao: configuracaoBuscaTecnica("Correias")!,
    medidas,
    valores: { comp_de: "762,5", perfil: "3L" },
    facetas: { material: [], dureza: [], vedacao: [] },
    perfis: ["3L"],
  }));
  assert.match(html, /Como medir uma correia/);
  assert.match(html, /referência de medição/);
  assert.match(html, /name="comp_de"[^>]*value="762,5"/);
  assert.match(html, /name="perfil"/);
  assert.match(html, /name="perfil"[^>]*aria-label="Perfil"/);
  assert.doesNotMatch(html, /name="di_de"|name="de_de"|name="alt_de"/);
});
