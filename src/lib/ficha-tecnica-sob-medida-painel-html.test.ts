import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import FichaTecnicaSobMedida from "../components/painel/FichaTecnicaSobMedida";
import { criarFichaTecnicaSobMedida } from "./ficha-tecnica-sob-medida";
import type { ProjetoSobMedidaPainel } from "./painel-sob-medida";

const ficha = criarFichaTecnicaSobMedida({
  referencia: "CFG-ABCDEFGHIJKL",
  referenciaOrigem: "CFG-ORIGEM123456",
  contratoVersao: 1,
  criadaEm: new Date("2026-11-01T12:30:00.000Z"),
  configuracao: {
    dimensoes: { larguraCm: 80, alturaCm: 60, profundidadeCm: 120 },
    materialExterno: "aco_galvanizado",
    acabamento: "pintura_eletrostatica",
    tampa: "superior",
    mobilidade: "rodizios",
    divisorias: 2,
    quantidade: 3,
    observacoes: "Uso industrial em área coberta.",
  },
});

const projeto: ProjetoSobMedidaPainel = {
  id: "sol-1",
  referencia: ficha.referencia,
  referenciaOrigem: ficha.referenciaOrigem,
  contratoVersao: ficha.contratoVersao,
  fichaTecnicaVersao: ficha.versao,
  previaVersao: ficha.previaVersao,
  fichaTecnica: ficha,
  estado: "RECEBIDA",
  resumo: "80 × 60 × 120 cm",
  nome: "Maria Silva",
  email: "maria@example.com",
  telefone: "5517999999999",
  criadoEm: new Date("2026-11-01T12:30:00.000Z"),
};

test("ficha do painel mostra prévia, especificação, origem e aviso de validação", () => {
  const html = renderToStaticMarkup(createElement(FichaTecnicaSobMedida, { projeto }));

  assert.match(html, /src="\/api\/painel\/sob-medida\/sol-1\/previa\.svg"/u);
  assert.match(html, /80 × 60 × 120 cm/u);
  assert.match(html, /Aço galvanizado/u);
  assert.match(html, /Pintura eletrostática/u);
  assert.match(html, /CFG-ORIGEM123456/u);
  assert.match(html, /Uso industrial em área coberta\./u);
  assert.match(html, /Sujeito à validação da fábrica; não é desenho liberado para fabricação\./u);
  assert.match(html, /Imprimir ficha/u);
  assert.doesNotMatch(html, /chaveRetomadaHash|codigoRetomada|hash/u);
});

test("impressão restaura a visibilidade da ficha ocultada pela regra global", () => {
  const globalCss = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
  const painelCss = readFileSync(new URL("../app/plataforma/(admin)/painel.css", import.meta.url), "utf8");

  assert.match(globalCss, /body \*\s*\{\s*visibility:\s*hidden;/u);
  assert.match(painelCss, /\.ficha-sob-medida,\s*\.ficha-sob-medida \*\s*\{\s*visibility:\s*visible;/u);
});
