import assert from "node:assert/strict";
import test from "node:test";
import { conferirSaude } from "./saude";

/**
 * O deploy decide rollback por este corpo, então ele é contrato: quem mudar
 * campo ou código de status quebra `deploy/deploy.sh`, o healthcheck do
 * compose e `scripts/smoke-publicacao.mjs` de uma vez.
 */

test("banco respondendo devolve 200, ok e latência medida", async () => {
  const { corpo, status } = await conferirSaude(async () => [{ "?column?": 1 }]);
  assert.equal(status, 200);
  assert.equal(corpo.ok, true);
  assert.equal(corpo.banco, "ok");
  assert.equal(corpo.servico, "lojas-avilaops");
  assert.ok(corpo.latenciaBancoMs >= 0 && Number.isFinite(corpo.latenciaBancoMs));
  assert.ok(!Number.isNaN(Date.parse(corpo.agora)));
});

test("banco fora do ar devolve 503 com corpo, não exceção", async () => {
  const { corpo, status } = await conferirSaude(async () => { throw new Error("connect ECONNREFUSED"); });
  assert.equal(status, 503);
  assert.equal(corpo.ok, false);
  assert.equal(corpo.banco, "indisponivel");
});

test("a mensagem do erro do banco não vaza na resposta", async () => {
  const { corpo } = await conferirSaude(async () => { throw new Error("password authentication failed for user \"lojas\""); });
  assert.equal(JSON.stringify(corpo).includes("password"), false);
});

test("a latência conta o tempo real da consulta", async () => {
  const { corpo } = await conferirSaude(() => new Promise((r) => setTimeout(r, 25)));
  assert.ok(corpo.latenciaBancoMs >= 20, `mediu ${corpo.latenciaBancoMs} ms`);
});
