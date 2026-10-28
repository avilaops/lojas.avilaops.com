import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "node:http";
import { gunzipSync } from "node:zlib";
import { GenerateContentResponse } from "@google/genai";
import { langfuseConfigurado, rastrearGeracaoGemini, usoGemini } from "./langfuse";

test("Langfuse exige destino explícito e ambas as credenciais; permite desligamento", () => {
  const configurado = { LANGFUSE_BASE_URL: "https://langfuse.example", LANGFUSE_PUBLIC_KEY: "public", LANGFUSE_SECRET_KEY: "secret" };
  assert.equal(langfuseConfigurado(configurado), true);
  assert.equal(langfuseConfigurado({}), false);
  for (const campo of Object.keys(configurado)) {
    assert.equal(langfuseConfigurado({ ...configurado, [campo]: " " }), false);
  }
  assert.equal(langfuseConfigurado({ ...configurado, LANGFUSE_TRACING_ENABLED: "false" }), false);
});

test("uso Gemini inclui raciocínio na saída sem duplicar o total e não estima tokens ausentes", () => {
  assert.deepEqual(usoGemini({ promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 30, totalTokenCount: 150 }), {
    input: 100, output: 50, total: 150,
  });
  assert.deepEqual(usoGemini({ promptTokenCount: 0, candidatesTokenCount: 0 }), { input: 0, output: 0 });
  assert.deepEqual(usoGemini({ promptTokenCount: NaN, candidatesTokenCount: -1, totalTokenCount: Infinity }), {});
  assert.deepEqual(usoGemini(), {});
});

test("desabilitado preserva a resposta e o erro do provedor sem repetir chamadas", async () => {
  const anterior = process.env.LANGFUSE_TRACING_ENABLED;
  process.env.LANGFUSE_TRACING_ENABLED = "false";
  try {
    const resposta = new GenerateContentResponse();
    let chamadas = 0;
    assert.equal(await rastrearGeracaoGemini("copy-produto", "gemini-test", async () => {
      chamadas++;
      return resposta;
    }), resposta);
    const erro = new Error("conteúdo privado não deve entrar na telemetria");
    await assert.rejects(rastrearGeracaoGemini("diagnostico-marca", "gemini-test", async () => {
      chamadas++;
      throw erro;
    }), (recebido) => recebido === erro);
    assert.equal(chamadas, 2);
  } finally {
    if (anterior === undefined) delete process.env.LANGFUSE_TRACING_ENABLED;
    else process.env.LANGFUSE_TRACING_ENABLED = anterior;
  }
});

test("exportação real OTLP contém modelo, uso e erro seguro, sem conteúdo privado", async () => {
  const envAnterior = { ...process.env };
  const cargas: string[] = [];
  const servidor = createServer(async (request, response) => {
    const partes: Buffer[] = [];
    for await (const parte of request) partes.push(Buffer.from(parte));
    const corpo = Buffer.concat(partes);
    cargas.push((request.headers["content-encoding"] === "gzip" ? gunzipSync(corpo) : corpo).toString());
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end("{}");
  });
  await new Promise<void>((resolve) => servidor.listen(0, "127.0.0.1", resolve));
  try {
    const endereco = servidor.address();
    assert.ok(endereco && typeof endereco !== "string");
    process.env.LANGFUSE_BASE_URL = `http://127.0.0.1:${endereco.port}`;
    process.env.LANGFUSE_PUBLIC_KEY = "public-test-only";
    process.env.LANGFUSE_SECRET_KEY = "secret-test-only";
    process.env.LANGFUSE_TRACING_ENABLED = "true";
    const resposta = new GenerateContentResponse();
    resposta.usageMetadata = { promptTokenCount: 10, candidatesTokenCount: 4, totalTokenCount: 14 };
    resposta.candidates = [{ content: { parts: [{ text: "RESPOSTA-PRIVADA" }] } }];
    assert.equal(await rastrearGeracaoGemini("seo-categoria", "gemini-test", async () => resposta), resposta);
    const erro = new Error("ERRO-PRIVADO api-key-secreta");
    await assert.rejects(rastrearGeracaoGemini("copy-produto", "gemini-test", async () => { throw erro; }), (recebido) => recebido === erro);
    assert.equal(cargas.length, 2, "forceFlush entrega as observações antes do retorno");
    const dados = cargas.join("\n");
    assert.match(dados, /lojas\.gemini\.seo-categoria/);
    assert.match(dados, /gemini-test/);
    assert.match(dados, /usage_details/);
    assert.match(dados, /ERROR/);
    assert.doesNotMatch(dados, /RESPOSTA-PRIVADA|ERRO-PRIVADO|api-key-secreta|secret-test-only/);
    const spans = cargas.flatMap((carga) => JSON.parse(carga).resourceSpans.flatMap(
      (recurso: { scopeSpans: { spans: { attributes: { key: string; value: { stringValue?: string } }[] }[] }[] }) => recurso.scopeSpans.flatMap((escopo) => escopo.spans),
    ));
    assert.equal(spans.length, 2);
    assert.ok(spans.every((span) => span.attributes.some((atributo: { key: string; value: { stringValue?: string } }) =>
      atributo.key === "langfuse.observation.type" && atributo.value.stringValue === "generation")));
  } finally {
    process.env = envAnterior;
    await new Promise<void>((resolve, reject) => servidor.close((erro) => erro ? reject(erro) : resolve()));
  }
});
