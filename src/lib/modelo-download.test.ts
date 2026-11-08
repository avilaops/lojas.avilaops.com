import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { baixarModelo } from "../../packages/removedor-de-fundo/src/modelo";

test("download do modelo abandona origem parada e tenta o espelho seguinte", async t => {
  const pasta = await mkdtemp(path.join(tmpdir(), "lojas-modelo-"));
  const nomes = ["FUNDO_MODELOS_DIR", "FUNDO_DOWNLOAD_TIMEOUT_MS", "FUNDO_MODELO_URL"] as const;
  const antes = Object.fromEntries(nomes.map(nome => [nome, process.env[nome]]));
  process.env.FUNDO_MODELOS_DIR = pasta;
  process.env.FUNDO_DOWNLOAD_TIMEOUT_MS = "10";
  delete process.env.FUNDO_MODELO_URL;
  let chamadas = 0;
  t.mock.method(globalThis, "fetch", async (_url: unknown, init?: RequestInit) => {
    chamadas++;
    assert.ok(init?.signal);
    if (chamadas === 1) return new Promise<Response>((_resolve,reject) => {
      // Timer mantém o processo vivo até o AbortSignal disparar no teste.
      const timer = setTimeout(() => reject(new Error("Origem não foi cancelada")), 1000);
      init.signal!.addEventListener("abort", () => { clearTimeout(timer); reject(init.signal!.reason); }, { once: true });
    });
    return new Response(new Uint8Array(1_100_000));
  });
  try {
    const arquivo = await baixarModelo("u2netp");
    assert.equal(chamadas, 2);
    assert.equal((await readFile(arquivo)).byteLength, 1_100_000);
  } finally {
    for (const nome of nomes) { if (antes[nome] === undefined) delete process.env[nome]; else process.env[nome] = antes[nome]; }
    await rm(pasta, { recursive: true, force: true });
  }
});
