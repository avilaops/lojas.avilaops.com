import { test } from "node:test";
import assert from "node:assert/strict";
import * as delivery from "../../deploy/render/release.mjs";
import * as startup from "../../deploy/render/start.mjs";
const sha = "a".repeat(40);
const env = { GITHUB_REPOSITORY: "avilaops/lojas.avilaops.com", GITHUB_REF_NAME: "main", GITHUB_REF: "refs/heads/main", GITHUB_SHA: sha, GITHUB_RUN_ID: "100", GITHUB_TOKEN: "github-token-sintetico" };
function github(refSha, runs) { return async url => Response.json(String(url).includes("/git/ref/") ? { object: { sha: refSha } } : { workflow_runs: runs }); }
test("entrega recusa HEAD antigo antes de modificar o destino", async () => {
  await assert.rejects(() => delivery.conferirEntregaAtual(env, github("b".repeat(40), [])), /SUPERSEDED_DEPLOYMENT/);
});
test("entrega recusa execução antiga mesmo com SHA igual após outra execução", async () => {
  await assert.rejects(() => delivery.conferirEntregaAtual(env, github(sha, [{ id: 101, event: "push", head_branch: "main" }])), /SUPERSEDED_DEPLOYMENT/);
  assert.equal(await delivery.conferirEntregaAtual(env, github(sha, [{ id: 100, event: "push", head_branch: "main" }])), true);
});
test("falha ao conferir GitHub impede entrega e não significa execução atual", async () => {
  await assert.rejects(() => delivery.conferirEntregaAtual(env, async () => new Response(null, { status: 503 })), /DELIVERY_CHECK_FAILED/);
});
test("recuperação inicia com agendador desligado e permite opção explícita posterior", () => {
  assert.equal(startup.ambienteDaRelease({}, "/tmp/runtime", sha).ROTINAS_AGENDADOR, "0");
  assert.equal(startup.ambienteDaRelease({ ROTINAS_AGENDADOR: "1" }, "/tmp/runtime", sha).ROTINAS_AGENDADOR, "1");
});
