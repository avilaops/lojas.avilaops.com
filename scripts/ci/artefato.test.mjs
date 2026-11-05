import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { contexto, registrar, verificar } from "./artefato.mjs";

const env = { GITHUB_SHA: "a".repeat(40), GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "1" };

test("artefatos exigem identidade de execução e commit válidos", () => {
  assert.throws(() => contexto({}), /INVALID_CI_CONTEXT/);
  assert.throws(() => contexto({ ...env, GITHUB_RUN_ID: "outra" }), /INVALID_CI_CONTEXT/);
});

test("consumidor recusa outro commit, execução, tentativa, tipo ou bytes", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "lojas-artifact-"));
  try {
    await writeFile(path.join(directory, "payload.tar.zst"), "payload de teste");
    await registrar(directory, "dependencias", env);
    assert.equal((await verificar(directory, "dependencias", env)).sha, env.GITHUB_SHA);
    for (const override of [
      { GITHUB_SHA: "b".repeat(40) }, { GITHUB_RUN_ID: "124" }, { GITHUB_RUN_ATTEMPT: "2" },
    ]) await assert.rejects(verificar(directory, "dependencias", { ...env, ...override }), /FOREIGN_CI_ARTIFACT/);
    await assert.rejects(verificar(directory, "build", env), /FOREIGN_CI_ARTIFACT/);
    await writeFile(path.join(directory, "payload.tar.zst"), "bytes alterados");
    await assert.rejects(verificar(directory, "dependencias", env), /CORRUPT_CI_ARTIFACT/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
