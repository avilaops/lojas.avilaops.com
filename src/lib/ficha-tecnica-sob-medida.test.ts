import assert from "node:assert/strict";
import test from "node:test";
import {
  FichaTecnicaSobMedidaSchema,
  criarFichaTecnicaSobMedida,
  gerarPreviaSvgSobMedida,
  VERSAO_FICHA_TECNICA_SOB_MEDIDA,
  VERSAO_PREVIA_SOB_MEDIDA,
} from "./ficha-tecnica-sob-medida";
import type { ConfiguracaoSobMedida } from "./configurador-sob-medida";

const configuracao: ConfiguracaoSobMedida = {
  dimensoes: { larguraCm: 80, alturaCm: 60, profundidadeCm: 120 },
  materialExterno: "aco_galvanizado",
  acabamento: "pintura_eletrostatica",
  tampa: "superior",
  mobilidade: "rodizios",
  divisorias: 2,
  quantidade: 3,
  observacoes: "Uso em área coberta.",
};

test("snapshot técnico congela códigos, rótulos, origem e versões sem contato", () => {
  const ficha = criarFichaTecnicaSobMedida({
    referencia: "CFG-ABCDEFGHIJKL",
    referenciaOrigem: "CFG-ORIGEM123456",
    contratoVersao: 1,
    criadaEm: new Date("2026-11-01T12:30:00.000Z"),
    configuracao,
  });

  assert.deepEqual(ficha, {
    versao: 1,
    previaVersao: 1,
    referencia: "CFG-ABCDEFGHIJKL",
    referenciaOrigem: "CFG-ORIGEM123456",
    contratoVersao: 1,
    criadaEm: "2026-11-01T12:30:00.000Z",
    dimensoes: { larguraCm: 80, alturaCm: 60, profundidadeCm: 120 },
    materialExterno: { codigo: "aco_galvanizado", rotulo: "Aço galvanizado" },
    acabamento: { codigo: "pintura_eletrostatica", rotulo: "Pintura eletrostática" },
    tampa: { codigo: "superior", rotulo: "Tampa superior" },
    mobilidade: { codigo: "rodizios", rotulo: "Rodízios" },
    divisorias: 2,
    quantidade: 3,
    observacoes: "Uso em área coberta.",
  });
  assert.equal(VERSAO_FICHA_TECNICA_SOB_MEDIDA, 1);
  assert.equal(VERSAO_PREVIA_SOB_MEDIDA, 1);
  assert.equal("nome" in ficha, false);
  assert.equal("email" in ficha, false);
  assert.equal("telefone" in ficha, false);
  assert.equal("chaveRetomadaHash" in ficha, false);
});

test("schema recusa snapshot parcial ou rótulo que não corresponde ao código", () => {
  const ficha = criarFichaTecnicaSobMedida({
    referencia: "CFG-ABCDEFGHIJKL",
    referenciaOrigem: null,
    contratoVersao: 1,
    criadaEm: new Date("2026-11-01T12:30:00.000Z"),
    configuracao,
  });

  assert.equal(FichaTecnicaSobMedidaSchema.safeParse({ ...ficha, quantidade: undefined }).success, false);
  assert.equal(FichaTecnicaSobMedidaSchema.safeParse({
    ...ficha,
    materialExterno: { codigo: "aco_galvanizado", rotulo: "Alumínio" },
  }).success, false);
});

test("a mesma ficha gera o mesmo SVG e dimensões diferentes mudam a geometria", () => {
  const base = {
    referencia: "CFG-ABCDEFGHIJKL",
    referenciaOrigem: null,
    contratoVersao: 1,
    criadaEm: new Date("2026-11-01T12:30:00.000Z"),
  };
  const ficha = criarFichaTecnicaSobMedida({ ...base, configuracao });
  const outra = criarFichaTecnicaSobMedida({
    ...base,
    configuracao: { ...configuracao, dimensoes: { larguraCm: 160, alturaCm: 60, profundidadeCm: 40 } },
  });

  const primeira = gerarPreviaSvgSobMedida(ficha);
  const segunda = gerarPreviaSvgSobMedida(ficha);
  const geometriaPrimeira = primeira.match(/<polygon data-face="frente" points="([^"]+)"/u)?.[1];
  const geometriaOutra = gerarPreviaSvgSobMedida(outra).match(/<polygon data-face="frente" points="([^"]+)"/u)?.[1];

  assert.equal(primeira, segunda);
  assert.ok(geometriaPrimeira);
  assert.ok(geometriaOutra);
  assert.notEqual(geometriaPrimeira, geometriaOutra);
  assert.match(primeira, /80 × 60 × 120 cm/u);
  assert.match(primeira, /Aço galvanizado/u);
});

test("SVG permanece válido nos limites e não inclui observações livres nem PII", () => {
  const ficha = criarFichaTecnicaSobMedida({
    referencia: "CFG-ABCDEFGHIJKL",
    referenciaOrigem: null,
    contratoVersao: 1,
    criadaEm: new Date("2026-11-01T12:30:00.000Z"),
    configuracao: {
      ...configuracao,
      dimensoes: { larguraCm: 20, alturaCm: 300, profundidadeCm: 300 },
      observacoes: "<script>alert('x')</script> nome@exemplo.com +55 17 99999-9999",
    },
  });

  const svg = gerarPreviaSvgSobMedida(ficha);

  assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" viewBox="0 0 960 640"/u);
  assert.doesNotMatch(svg, /NaN|Infinity|script|alert|nome@exemplo|99999/u);
  assert.match(svg, /20 × 300 × 300 cm/u);
});
