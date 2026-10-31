import assert from "node:assert/strict";
import test from "node:test";
import { criarSolicitacaoSobMedida, type DadosPersistenciaSolicitacao } from "./solicitacoes-sob-medida";

const entrada = {
  configuracao: {
    dimensoes: { larguraCm: 80, alturaCm: 60, profundidadeCm: 120 },
    materialExterno: "aco_galvanizado",
    acabamento: "pintura_eletrostatica",
    tampa: "superior",
    mobilidade: "rodizios",
    divisorias: 2,
    quantidade: 3,
    observacoes: "Uso industrial",
  },
  nome: "Maria Silva",
  email: "maria@example.com",
  telefone: "",
  consentimento: true,
} as const;

test("criação persiste revisão validada no tenant informado", async () => {
  let gravado: DadosPersistenciaSolicitacao | undefined;
  const resposta = await criarSolicitacaoSobMedida("tenant-mrg", entrada, async (dados) => {
    gravado = dados;
    return { id: "sol-1", referencia: dados.referencia, criadoEm: new Date("2026-10-31T14:00:00Z") };
  });

  assert.equal(gravado?.tenantId, "tenant-mrg");
  assert.equal(gravado?.contratoVersao, 1);
  assert.equal(gravado?.nome, "Maria Silva");
  assert.match(String(gravado?.referencia), /^MRG-[A-Z0-9]{12}$/);
  assert.deepEqual(resposta, { referencia: gravado?.referencia, criadoEm: new Date("2026-10-31T14:00:00Z") });
});

test("criação recusa payload inválido antes de chamar persistência", async () => {
  let chamadas = 0;
  await assert.rejects(
    criarSolicitacaoSobMedida("tenant-mrg", { ...entrada, consentimento: false }, async () => {
      chamadas += 1;
      throw new Error("não deveria gravar");
    }),
  );
  assert.equal(chamadas, 0);
});
