import assert from "node:assert/strict";
import test from "node:test";
import { criarDirecaoVisual, lerIdentidade } from "./identidade";

test("gera direção tecnológica coerente a partir do diagnóstico", () => {
  const direcao = criarDirecaoVisual({
    segmento: "tecnologia",
    publico: "pequenas empresas que precisam vender melhor",
    diferencial: "implantação acompanhada e operação integrada",
    personalidade: ["tecnologica", "sofisticada"],
    tomDeVoz: "especialista",
    objetivo: "vender",
    estiloFotografico: "tecnico",
  }, "Loja Exemplo");
  assert.equal(direcao.tema.layout, "vitrine");
  assert.equal(direcao.tema.modo, "escuro");
  assert.equal(direcao.identidade.segmento, "tecnologia");
  assert.match(direcao.identidade.assinatura, /implantação acompanhada/);
  assert.match(direcao.identidade.direcaoFotografica, /Detalhes/);
});

test("normaliza identidade vazia com padrões seguros", () => {
  const identidade = lerIdentidade({});
  assert.equal(identidade.segmento, "outro");
  assert.deepEqual(identidade.personalidade, ["sofisticada"]);
  assert.match(identidade.corApoio, /^#[0-9a-f]{6}$/i);
});
