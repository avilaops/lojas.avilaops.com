import { test } from "node:test";
import assert from "node:assert/strict";
import { salvarBytes } from "./uploads";
import { GET } from "../app/uploads/[...caminho]/route";

async function remoto(acao: (operacoes: Array<{ metodo: string; url: string }>) => Promise<void>) {
  const anterior = { url: process.env.LOJAS_STORAGE_URL, token: process.env.LOJAS_STORAGE_TOKEN, fetch: globalThis.fetch };
  const objetos = new Map<string, Uint8Array>();
  const operacoes: Array<{ metodo: string; url: string }> = [];
  process.env.LOJAS_STORAGE_URL = "https://storage.example.test";
  process.env.LOJAS_STORAGE_TOKEN = "segredo-de-teste";
  globalThis.fetch = async (entrada, init) => {
    const url = String(entrada);
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer segredo-de-teste");
    assert.equal(init?.redirect, "error");
    const metodo = init?.method ?? "GET";
    operacoes.push({ metodo, url });
    if (metodo === "PUT") {
      objetos.set(url, new Uint8Array(await new Response(init?.body).arrayBuffer()));
      return new Response(null, { status: 204 });
    }
    const bytes = objetos.get(url);
    return bytes ? new Response(new Uint8Array(bytes)) : new Response(null, { status: 404 });
  };
  try { await acao(operacoes); } finally {
    globalThis.fetch = anterior.fetch;
    if (anterior.url === undefined) delete process.env.LOJAS_STORAGE_URL; else process.env.LOJAS_STORAGE_URL = anterior.url;
    if (anterior.token === undefined) delete process.env.LOJAS_STORAGE_TOKEN; else process.env.LOJAS_STORAGE_TOKEN = anterior.token;
  }
}

test("upload e leitura usam armazenamento remoto e preservam URL pública", async () => {
  await remoto(async (operacoes) => {
    const bytes = Buffer.from("imagem persistida fora do processo");
    const salvo = await salvarBytes("qa-r2-recovery", bytes, "png");
    assert.match(salvo.url, /\/uploads\/qa-r2-recovery\/.+\.png$/);
    assert.equal(operacoes[0]?.metodo, "PUT", "o upload precisa persistir no R2");
    const resposta = await GET(new Request(salvo.url), { params: Promise.resolve({ caminho: salvo.caminho.split("/") }) });
    assert.equal(resposta.status, 200);
    assert.deepEqual(Buffer.from(await resposta.arrayBuffer()), bytes);
    assert.equal(operacoes.at(-1)?.metodo, "GET");
    assert.equal(resposta.headers.get("content-type"), "image/png");
  });
});

test("falha remota é indisponibilidade e não um falso arquivo inexistente", async () => {
  await remoto(async () => {
    globalThis.fetch = async () => new Response(null, { status: 503 });
    const resposta = await GET(new Request("https://lojas.example/uploads/qa-r2-recovery/ausente.png"), { params: Promise.resolve({ caminho: ["qa-r2-recovery", "ausente.png"] }) });
    assert.equal(resposta.status, 503);
    assert.match(resposta.headers.get("cache-control") ?? "", /no-store/);
    await assert.rejects(salvarBytes("qa-r2-recovery", Buffer.from("dados"), "png"));
  });
});

test("caminho privado Pix e travessia nunca consultam armazenamento pela rota pública", async () => {
  await remoto(async (operacoes) => {
    for (const caminho of [["qa-r2-recovery", "pix", "comprovante.pdf"], ["..", "segredo.png"], ["qa-r2-recovery", "..%2fsegredo.png"]]) {
      const resposta = await GET(new Request("https://lojas.example/uploads/teste"), { params: Promise.resolve({ caminho }) });
      assert.equal(resposta.status, 404);
    }
    assert.equal(operacoes.length, 0);
  });
});

test("configuração remota parcial não permite gravação silenciosa em disco efêmero", async () => {
  await remoto(async () => {
    delete process.env.LOJAS_STORAGE_TOKEN;
    await assert.rejects(salvarBytes("qa-r2-recovery", Buffer.from("dados"), "png"), /configura/i);
  });
});
