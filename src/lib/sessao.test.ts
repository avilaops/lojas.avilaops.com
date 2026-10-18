import assert from "node:assert/strict";
import { test } from "node:test";
import type { Tenant } from "@prisma/client";
import { emitirToken, lerToken, resolverSessaoDoPainel } from "./sessao";

const tenant = { id: "loja-1", status: "ATIVA" } as Tenant;

test("sessão de operador removido não mantém acesso ao painel", () => {
  assert.equal(resolverSessaoDoPainel(tenant, "operador-removido", null), null);
});

test("sessão sem operador continua representando o dono", () => {
  assert.deepEqual(resolverSessaoDoPainel(tenant, undefined, null), {
    tenant,
    papel: "DONO",
    operador: null,
  });
});

test("sessão da equipe preserva a permissão de trocar de loja", () => {
  const anterior = process.env.LOJAS_SECRET;
  process.env.LOJAS_SECRET = "1".repeat(64);
  try {
    const token = emitirToken("brilhax", null, { equipe: true });
    assert.deepEqual(lerToken(token), { slug: "brilhax", equipe: true });
  } finally {
    if (anterior === undefined) delete process.env.LOJAS_SECRET;
    else process.env.LOJAS_SECRET = anterior;
  }
});

test("sessão comum não ganha permissão de equipe por omissão", () => {
  const anterior = process.env.LOJAS_SECRET;
  process.env.LOJAS_SECRET = "2".repeat(64);
  try {
    const token = emitirToken("brilhax");
    assert.deepEqual(lerToken(token), { slug: "brilhax" });
  } finally {
    if (anterior === undefined) delete process.env.LOJAS_SECRET;
    else process.env.LOJAS_SECRET = anterior;
  }
});
