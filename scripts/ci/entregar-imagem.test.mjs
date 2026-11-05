import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const script = path.resolve("scripts/ci/entregar-imagem.sh");
const digest = `ghcr.io/avilaops/lojas.avilaops.com@sha256:${"a".repeat(64)}`;

async function executar(overrides = {}) {
  const root = await mkdtemp(path.join(tmpdir(), "lojas-delivery-"));
  try {
    const bin = path.join(root, "bin");
    const temporary = path.join(root, "temporary");
    await mkdir(bin);
    await mkdir(temporary);
    await writeFile(path.join(bin, "gh"), `#!/bin/bash
set -eu
# A CLI recusa slurp junto com jq. Preservar essa fronteira no adaptador.
[[ "$*" != *--slurp* || "$*" != *--jq* ]] || exit 99
if [[ "$2" == */actions/runs/* ]]; then
  printf '%s' "$RUN_CREATED_AT"
else
  printf '%s' "$NEWER_RUNS"
fi
`, { mode: 0o755 });
    await writeFile(path.join(bin, "ssh"), '#!/bin/bash\nset -eu\nprintf "%s\\n" "$*" > "$TEST_ROOT/ssh"\ncat > "$TEST_ROOT/token"\nexit "$SSH_STATUS"\n', { mode: 0o755 });
    const result = spawnSync("bash", [script], {
      encoding: "utf8",
      env: {
        ...process.env, PATH: `${bin}:${process.env.PATH}`, TMPDIR: temporary, TEST_ROOT: root,
        GITHUB_REPOSITORY: "avilaops/lojas.avilaops.com", GITHUB_RUN_ID: "123",
        GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REF: "refs/heads/main", DEFAULT_BRANCH: "main",
        GITHUB_OUTPUT: path.join(root, "output"), DEPLOY_OPERATION: "prepare", APPLICATION: "lojas.avilaops.com",
        IMAGE: digest, DEPLOY_HOST: "server.example", DEPLOY_USER: "deploy", DEPLOY_PORT: "22",
        SSH_KEY: "key-for-test", GHCR_TOKEN: "token-for-test", KNOWN_HOSTS: "known-host-for-test",
        NEWER_RUNS: "0", RUN_CREATED_AT: "2026-11-05T15:00:00Z", SSH_STATUS: "0", ...overrides,
      },
    });
    const read = name => readFile(path.join(root, name), "utf8").catch(error => {
      if (error.code === "ENOENT") return null;
      throw error;
    });
    return { ...result, output: await read("output"), ssh: await read("ssh"), token: await read("token"), temporary: await readdir(temporary) };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("prepare e deploy enviam somente o digest autorizado sem expor credenciais", async () => {
  for (const operation of ["prepare", "deploy"]) {
    const result = await executar({ DEPLOY_OPERATION: operation });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(result.ssh.endsWith(`${operation} lojas.avilaops.com ${digest}\n`));
    assert.ok(result.ssh.includes("StrictHostKeyChecking=yes"));
    assert.equal(result.token, "token-for-test\n");
    assert.equal(result.output, "publicar=true\n");
    assert.deepEqual(result.temporary, []);
    assert.ok(!`${result.stdout}${result.stderr}`.includes("token-for-test"));
  }
});

test("run superado não conecta ao servidor e não comprova publicação", async () => {
  for (const pages of ["1", "0\n1", "0\n0\n2"]) {
    const result = await executar({ NEWER_RUNS: pages });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.ssh, null);
    assert.equal(result.output, "publicar=false\n");
  }
});

test("falha de SSH não publica sucesso e remove chave temporária", async () => {
  const result = await executar({ SSH_STATUS: "42" });
  assert.equal(result.status, 42);
  assert.equal(result.output, null);
  assert.deepEqual(result.temporary, []);
});

test("evento, ramo, operação e destino inválidos falham antes de conectar", async () => {
  for (const overrides of [
    { GITHUB_EVENT_NAME: "pull_request" }, { GITHUB_EVENT_NAME: "pull_request_target" },
    { GITHUB_REF: "refs/heads/feature" }, { DEPLOY_OPERATION: "exec" },
    { APPLICATION: "outro.example" }, { IMAGE: digest.replace("/lojas.avilaops.com@", "/outro@") },
    { IMAGE: "ghcr.io/avilaops/lojas.avilaops.com:latest" }, { IMAGE: `${digest};id` },
    { DEPLOY_HOST: "host;id" }, { DEPLOY_USER: "user;id" }, { DEPLOY_PORT: "0" },
    { NEWER_RUNS: "invalid" }, { RUN_CREATED_AT: "invalid" },
  ]) {
    const result = await executar(overrides);
    assert.notEqual(result.status, 0, JSON.stringify(overrides));
    assert.equal(result.ssh, null);
    assert.equal(result.output, null);
  }
});

test("política do projeto exige timeout nativo de um minuto em cada job", async () => {
  for (const name of ["deploy-production.yml", "merge-automatico.yml"]) {
    const text = await readFile(path.resolve(".github/workflows", name), "utf8");
    const jobs = text.split(/^jobs:\r?\n/m)[1];
    assert.ok(jobs, `${name}: jobs ausentes`);
    // Os workflows adotam blocos de jobs com duas colunas, sem anchors.
    const blocks = [...jobs.matchAll(/^  ([\w-]+):\r?\n/gm)];
    assert.ok(blocks.length > 0, `${name}: nenhum job encontrado`);
    for (let i = 0; i < blocks.length; i++) {
      const block = jobs.slice(blocks[i].index, blocks[i + 1]?.index ?? jobs.length);
      const timeouts = [...block.matchAll(/^    timeout-minutes:\s*(.*?)\s*$/gm)];
      assert.equal(timeouts.length, 1, `${name}/${blocks[i][1]}: timeout obrigatório e único`);
      assert.equal(timeouts[0][1], "1", `${name}/${blocks[i][1]}: limite da política Linear`);
    }
  }
});
