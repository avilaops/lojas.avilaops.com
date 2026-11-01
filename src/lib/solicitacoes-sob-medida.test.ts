import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  criarSolicitacaoSobMedida,
  RetomadaNaoEncontradaError,
  retomarConfiguracaoSobMedida,
  type DadosPersistenciaSolicitacao,
  type RegistroRetomadaSolicitacao,
} from "./solicitacoes-sob-medida";

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
  assert.match(String(gravado?.referencia), /^CFG-[A-Z0-9]{12}$/);
  assert.equal(resposta.referencia, gravado?.referencia);
  assert.deepEqual(resposta.criadoEm, new Date("2026-10-31T14:00:00Z"));
  assert.match(resposta.codigoRetomada, /^CFG-[A-Z0-9]{12}\.[A-Za-z0-9_-]{22}$/);
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

test("criação devolve uma chave privada e persiste somente o hash", async () => {
  let gravado: DadosPersistenciaSolicitacao | undefined;
  const resposta = await criarSolicitacaoSobMedida("tenant-mrg", entrada, async (dados) => {
    gravado = dados;
    return { id: "sol-1", referencia: dados.referencia, criadoEm: new Date("2026-11-01T12:00:00Z") };
  });

  assert.match(resposta.codigoRetomada, new RegExp(`^${resposta.referencia}\\.[A-Za-z0-9_-]{22}$`));
  const chave = resposta.codigoRetomada.slice(resposta.referencia.length + 1);
  assert.equal(gravado?.chaveRetomadaHash, createHash("sha256").update(chave).digest("hex"));
  assert.equal(JSON.stringify(gravado).includes(chave), false);
});

test("retomada restaura a ficha técnica sem contato nem observações", async () => {
  const chave = "abcdefghijklmnopqrstuv";
  const registro: RegistroRetomadaSolicitacao = {
    referencia: "CFG-ABCDEFGHIJKL",
    contratoVersao: 1,
    chaveRetomadaHash: createHash("sha256").update(chave).digest("hex"),
    configuracao: entrada.configuracao,
  };

  const resposta = await retomarConfiguracaoSobMedida(
    "tenant-mrg",
    { codigoRetomada: `${registro.referencia}.${chave}` },
    async (tenantId, referencia) => tenantId === "tenant-mrg" && referencia === registro.referencia ? registro : null,
  );

  assert.deepEqual(resposta, {
    referencia: "CFG-ABCDEFGHIJKL",
    contratoVersao: 1,
    configuracao: { ...entrada.configuracao, observacoes: "" },
  });
  assert.equal("nome" in resposta, false);
  assert.equal("email" in resposta, false);
  assert.equal("telefone" in resposta, false);
});

test("retomada não revela se a referência, a chave ou o tenant estão errados", async () => {
  const hash = createHash("sha256").update("abcdefghijklmnopqrstuv").digest("hex");
  const buscar = async (tenantId: string): Promise<RegistroRetomadaSolicitacao | null> => tenantId === "tenant-mrg" ? {
    referencia: "CFG-ABCDEFGHIJKL",
    contratoVersao: 1,
    chaveRetomadaHash: hash,
    configuracao: entrada.configuracao,
  } : null;

  await assert.rejects(
    retomarConfiguracaoSobMedida("tenant-mrg", { codigoRetomada: "CFG-ABCDEFGHIJKL.chaveincorretachavein" }, buscar),
    RetomadaNaoEncontradaError,
  );
  await assert.rejects(
    retomarConfiguracaoSobMedida("outro-tenant", { codigoRetomada: "CFG-ABCDEFGHIJKL.abcdefghijklmnopqrstuv" }, buscar),
    RetomadaNaoEncontradaError,
  );
});

test("nova solicitação só vincula uma origem comprovada pela chave", async () => {
  const chave = "abcdefghijklmnopqrstuv";
  const origem: RegistroRetomadaSolicitacao = {
    referencia: "CFG-ABCDEFGHIJKL",
    contratoVersao: 1,
    chaveRetomadaHash: createHash("sha256").update(chave).digest("hex"),
    configuracao: entrada.configuracao,
  };
  let gravado: DadosPersistenciaSolicitacao | undefined;

  await criarSolicitacaoSobMedida(
    "tenant-mrg",
    { ...entrada, codigoRetomadaOrigem: `${origem.referencia}.${chave}` },
    async (dados) => {
      gravado = dados;
      return { id: "sol-2", referencia: dados.referencia, criadoEm: new Date("2026-11-01T12:30:00Z") };
    },
    async () => origem,
  );
  assert.equal(gravado?.referenciaOrigem, origem.referencia);

  await assert.rejects(
    criarSolicitacaoSobMedida(
      "tenant-mrg",
      { ...entrada, codigoRetomadaOrigem: `${origem.referencia}.chaveincorretachavein` },
      async () => { throw new Error("não deveria gravar"); },
      async () => origem,
    ),
    RetomadaNaoEncontradaError,
  );
});
