import assert from "node:assert/strict";
import test from "node:test";
import { EntradaSolicitacaoSobMedidaSchema, ConfiguracaoSobMedidaSchema, resumoDaConfiguracao } from "./configurador-sob-medida";

const configuracao = {
  dimensoes: { larguraCm: 80, alturaCm: 60, profundidadeCm: 120 },
  materialExterno: "aco_galvanizado",
  acabamento: "pintura_eletrostatica",
  tampa: "superior",
  mobilidade: "rodizios",
  divisorias: 2,
  quantidade: 3,
  observacoes: "  uso em cozinha industrial  ",
} as const;

test("configuração aceita limites do editor e normaliza observações", () => {
  const resultado = ConfiguracaoSobMedidaSchema.parse(configuracao);
  assert.deepEqual(resultado.dimensoes, { larguraCm: 80, alturaCm: 60, profundidadeCm: 120 });
  assert.equal(resultado.observacoes, "uso em cozinha industrial");
});

test("configuração recusa dimensão, divisórias e quantidade fora do editor", () => {
  assert.equal(ConfiguracaoSobMedidaSchema.safeParse({ ...configuracao, dimensoes: { larguraCm: 19, alturaCm: 60, profundidadeCm: 120 } }).success, false);
  assert.equal(ConfiguracaoSobMedidaSchema.safeParse({ ...configuracao, divisorias: 11 }).success, false);
  assert.equal(ConfiguracaoSobMedidaSchema.safeParse({ ...configuracao, quantidade: 0 }).success, false);
});

test("solicitação exige consentimento e ao menos um contato válido", () => {
  const base = { configuracao, nome: "  Maria Silva  ", email: "MARIA@EXAMPLE.COM ", telefone: "", consentimento: true };
  const aceita = EntradaSolicitacaoSobMedidaSchema.parse(base);
  assert.equal(aceita.nome, "Maria Silva");
  assert.equal(aceita.email, "maria@example.com");
  assert.equal(EntradaSolicitacaoSobMedidaSchema.safeParse({ ...base, email: "", consentimento: true }).success, false);
  assert.equal(EntradaSolicitacaoSobMedidaSchema.safeParse({ ...base, consentimento: false }).success, false);
});

test("resumo é estável, legível e não afirma preço ou capacidade", () => {
  assert.equal(
    resumoDaConfiguracao(ConfiguracaoSobMedidaSchema.parse(configuracao)),
    "80 × 60 × 120 cm · Aço galvanizado · Pintura eletrostática · Tampa superior · 2 divisórias · Rodízios · 3 unidades",
  );
});
