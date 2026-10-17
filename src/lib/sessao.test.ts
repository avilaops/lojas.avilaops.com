import assert from "node:assert/strict";
import { test } from "node:test";
import type { Tenant } from "@prisma/client";
import { resolverSessaoDoPainel } from "./sessao";

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
