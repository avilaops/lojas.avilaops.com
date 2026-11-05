import assert from "node:assert/strict";
import test from "node:test";
import { copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { contexto, registrar, reunir, verificar } from "./artefato.mjs";

const env = { GITHUB_SHA: "a".repeat(40), GITHUB_RUN_ID: "123", GITHUB_RUN_ATTEMPT: "1" };

test("artefatos exigem identidade de execução e commit válidos", () => {
  assert.throws(() => contexto({}), /INVALID_CI_CONTEXT/);
  assert.throws(() => contexto({ ...env, GITHUB_RUN_ID: "outra" }), /INVALID_CI_CONTEXT/);
});

test("reunião preserva ordem e recusa parte ausente ou alterada", async () => {
  for (const failure of [null, "missing", "corrupt"]) {
    const root = await mkdtemp(path.join(tmpdir(), "lojas-parts-"));
    try {
      const producer = path.join(root, "producer");
      await mkdir(producer);
      const bytes = Buffer.from("0123456789abcdefghijklmn");
      await writeFile(path.join(producer, "payload.tar.zst"), bytes);
      await registrar(producer, "build", env);
      for (const [position, index] of ["00", "01", "02", "03"].entries()) {
        const part = path.join(root, `lojas-build-${index}-${env.GITHUB_SHA}`);
        await mkdir(part);
        if (!(failure === "missing" && position === 2)) {
          await writeFile(path.join(part, `part-${index}`), failure === "corrupt" && position === 2
            ? Buffer.from("invalid") : bytes.subarray(position * 6, (position + 1) * 6));
        }
        if (position === 0) await copyFile(path.join(producer, "manifest.json"), path.join(part, "manifest.json"));
      }
      if (failure === "missing") await assert.rejects(reunir(root, "build", env), { code: "ENOENT" });
      else if (failure === "corrupt") await assert.rejects(reunir(root, "build", env), /CORRUPT_CI_ARTIFACT/);
      else {
        await reunir(root, "build", env);
        assert.deepEqual(await readFile(path.join(root, `lojas-build-${env.GITHUB_SHA}`, "payload.tar.zst")), bytes);
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
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
