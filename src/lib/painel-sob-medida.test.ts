import assert from "node:assert/strict";
import test from "node:test";
import { criarFichaTecnicaSobMedida } from "./ficha-tecnica-sob-medida";
import {
  buscarProjetoSobMedidaNoPainel,
  type RegistroProjetoSobMedida,
} from "./painel-sob-medida";

const configuracao = {
  dimensoes: { larguraCm: 80, alturaCm: 60, profundidadeCm: 120 },
  materialExterno: "aco_galvanizado",
  acabamento: "pintura_eletrostatica",
  tampa: "superior",
  mobilidade: "rodizios",
  divisorias: 2,
  quantidade: 3,
  observacoes: "Uso industrial",
} as const;

const base: RegistroProjetoSobMedida = {
  id: "sol-1",
  referencia: "CFG-ABCDEFGHIJKL",
  referenciaOrigem: null,
  contratoVersao: 1,
  fichaTecnicaVersao: 1,
  previaVersao: 1,
  fichaTecnica: criarFichaTecnicaSobMedida({
    referencia: "CFG-ABCDEFGHIJKL",
    referenciaOrigem: null,
    contratoVersao: 1,
    criadaEm: new Date("2026-11-01T12:30:00.000Z"),
    configuracao,
  }),
  configuracao,
  estado: "RECEBIDA",
  resumo: "80 × 60 × 120 cm",
  nome: "Maria Silva",
  email: "maria@example.com",
  telefone: null,
  criadoEm: new Date("2026-11-01T12:30:00.000Z"),
};

test("consulta usa tenant e id juntos e entrega o snapshot persistido", async () => {
  const chamadas: Array<[string, string]> = [];
  const projeto = await buscarProjetoSobMedidaNoPainel("tenant-mrg", "sol-1", async (tenantId, id) => {
    chamadas.push([tenantId, id]);
    return tenantId === "tenant-mrg" && id === "sol-1" ? base : null;
  });

  assert.deepEqual(chamadas, [["tenant-mrg", "sol-1"]]);
  assert.deepEqual(projeto?.fichaTecnica, base.fichaTecnica);
  assert.equal(projeto?.nome, "Maria Silva");
});

test("id de outro tenant é indistinguível de projeto inexistente", async () => {
  const buscar = async (tenantId: string) => tenantId === "tenant-mrg" ? base : null;

  assert.equal(await buscarProjetoSobMedidaNoPainel("outro-tenant", "sol-1", buscar), null);
  assert.equal(await buscarProjetoSobMedidaNoPainel("tenant-mrg", "ausente", async () => null), null);
});

test("registro legado monta ficha em memória sem exigir escrita", async () => {
  let consultas = 0;
  const legado: RegistroProjetoSobMedida = {
    ...base,
    fichaTecnica: null,
    fichaTecnicaVersao: null,
    previaVersao: null,
  };

  const projeto = await buscarProjetoSobMedidaNoPainel("tenant-mrg", "sol-1", async () => {
    consultas += 1;
    return legado;
  });

  assert.equal(consultas, 1);
  assert.equal(projeto?.fichaTecnica.versao, 1);
  assert.equal(projeto?.fichaTecnica.referencia, legado.referencia);
  assert.equal(projeto?.fichaTecnica.criadaEm, legado.criadoEm.toISOString());
});

test("fallback legado despacha pelo contrato e recusa versão desconhecida", async () => {
  const legadoV1: RegistroProjetoSobMedida = {
    ...base,
    fichaTecnica: null,
    fichaTecnicaVersao: null,
    previaVersao: null,
    configuracao: {
      dimensoes: { larguraCm: 80, alturaCm: 60, profundidadeCm: 120 },
      materialExterno: "aco_galvanizado",
      acabamento: "pintura_eletrostatica",
      tampa: "superior",
      mobilidade: "rodizios",
      divisorias: 2,
      quantidade: 3,
      observacoes: "Fixture legada v1",
    },
  };
  const desconhecido = { ...legadoV1, contratoVersao: 99 };

  assert.equal((await buscarProjetoSobMedidaNoPainel("tenant-mrg", "sol-1", async () => legadoV1))?.fichaTecnica.contratoVersao, 1);
  assert.equal(await buscarProjetoSobMedidaNoPainel("tenant-mrg", "sol-1", async () => desconhecido), null);
});

test("snapshot parcial, divergente ou configuração histórica inválida falham fechados", async () => {
  const parcial = { ...base, previaVersao: null };
  const divergente = { ...base, fichaTecnica: { ...(base.fichaTecnica as object), referencia: "CFG-OUTRAREF1234" } };
  const legadoInvalido = { ...base, fichaTecnica: null, fichaTecnicaVersao: null, previaVersao: null, configuracao: { dimensoes: {} } };

  assert.equal(await buscarProjetoSobMedidaNoPainel("tenant-mrg", "sol-1", async () => parcial), null);
  assert.equal(await buscarProjetoSobMedidaNoPainel("tenant-mrg", "sol-1", async () => divergente), null);
  assert.equal(await buscarProjetoSobMedidaNoPainel("tenant-mrg", "sol-1", async () => legadoInvalido), null);
});
