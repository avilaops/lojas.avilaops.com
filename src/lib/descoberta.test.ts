import assert from "node:assert/strict";
import test from "node:test";
import type { Tenant } from "@prisma/client";
import { regrasRobots, visivelNaBusca } from "./descoberta";

const loja = (status: string) => ({ status, slug: "x", dominios: [], permiteTreinamentoIa: false }) as unknown as Tenant;
const bloqueiaTudo = (status: string) => {
  const r = regrasRobots(loja(status)).rules;
  return !Array.isArray(r) && r.disallow === "/";
};

test("loja suspensa continua liberada para os buscadores", () => {
  assert.equal(visivelNaBusca(loja("SUSPENSA")), true);
  assert.equal(bloqueiaTudo("SUSPENSA"), false);
  assert.equal(bloqueiaTudo("ATIVA"), false);
});

test("loja cancelada ou em provisionamento some da busca", () => {
  assert.equal(bloqueiaTudo("CANCELADA"), true);
  assert.equal(bloqueiaTudo("PROVISIONANDO"), true);
});

test("suspensão automática nasce desligada", async () => {
  const { suspensaoAutomatica } = await import("./assinatura");
  assert.equal(suspensaoAutomatica({}), false);
  assert.equal(suspensaoAutomatica({ LOJAS_SUSPENSAO_AUTOMATICA: "true" }), true);
});
