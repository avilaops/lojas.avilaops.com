import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { z } from "zod";

const schema = await import("../../src/lib/api-cupom-contrato.ts").catch(() => null);
const exporter = await import("../../scripts/contracts/export-schema.ts").catch(() => null);
const consumer = await import("../../examples/contracts/cupom-v1.ts").catch(() => null);
const input = { codigo: " TESTE10 ", itens: [{ id: "produto-sintetico", quantidade: 2 }] };
const success = { dados: { codigo: "TESTE10", tipo: "PERCENTUAL", descontoCentavos: 100 } };

test("contrato preserva trim, limites e rejeição de campos desconhecidos da rota", () => {
  assert.ok(schema, "Contrato compartilhado de cupom ainda não implementado");
  assert.equal(schema.ConsultaDeCupom.parse(input).codigo, "TESTE10");
  for (const invalid of [
    { ...input, codigo: " " }, { ...input, codigo: "x".repeat(41) },
    { ...input, itens: [] }, { ...input, itens: [{ id: "x", quantidade: 1000 }] },
    { ...input, itens: [{ id: "x", quantidade: 0 }] }, { ...input, itens: [{ id: "x", quantidade: 1.5 }] },
    { ...input, desconto: 100 }, { ...input, itens: [{ id: "x", quantidade: 1, preco: 1 }] },
  ]) assert.equal(schema.ConsultaDeCupom.safeParse(invalid).success, false);
  assert.ok(schema.ConsultaDeCupom.safeParse({ ...input, itens: Array.from({ length: 50 }, () => ({ id: "x", quantidade: 999 })) }).success);
  assert.equal(schema.ConsultaDeCupom.safeParse({ ...input, itens: Array.from({ length: 51 }, () => ({ id: "x", quantidade: 1 })) }).success, false);
});

test("baseline publicado coincide com a exportação dos schemas usados pela rota", async () => {
  assert.ok(schema && exporter, "Exportação de schemas ainda não implementada");
  const baseline = JSON.parse(await readFile(new URL("../../contracts/cupom.v1.json", import.meta.url), "utf8"));
  assert.deepEqual(exporter.exportCupomContract(), baseline);
  assert.throws(() => exporter.exportSchema(z.string().regex(/foo/)), /UNSUPPORTED_ZOD/);
  assert.throws(() => exporter.exportSchema(z.string().transform(value => value.toUpperCase())), /UNSUPPORTED_ZOD/);
});

test("contrato da saída recusa dinheiro fracionado e erro sem correlação", () => {
  assert.ok(schema, "Schema de saída ainda não implementado");
  assert.ok(schema.RespostaDeCupom.safeParse(success).success);
  assert.equal(schema.RespostaDeCupom.safeParse({ dados: { ...success.dados, descontoCentavos: 1.5 } }).success, false);
  assert.equal(schema.ErroDeCupom.safeParse({ erro: { codigo: "pedido_invalido", mensagem: "Cupom inválido" } }).success, false);
});

test("consumidor fixado faz HTTP real, aceita extensão e preserva erro/correlação", async () => {
  assert.ok(consumer, "Consumidor independente ainda não implementado");
  let answer = success;
  let status = 200;
  let requestBody;
  let requestPath;
  let authorization;
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    requestBody = JSON.parse(Buffer.concat(chunks).toString());
    requestPath = request.url;
    authorization = request.headers.authorization;
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(answer));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  try {
    const url = `http://127.0.0.1:${address.port}`;
    assert.deepEqual(await consumer.consultarCupom(url, "sintetica-nao-operacional", input), success.dados);
    assert.equal(requestPath, "/api/v1/vitrine/cupom");
    assert.equal(authorization, "Bearer sintetica-nao-operacional");
    assert.deepEqual(requestBody, input);
    answer = { dados: { ...success.dados, novoCampo: true } };
    assert.equal((await consumer.consultarCupom(url, "sintetica", input)).descontoCentavos, 100);
    status = 422;
    answer = { erro: { codigo: "pedido_invalido", mensagem: "Cupom inválido", detalhe: "cupom_invalido" }, requisicao: "req-sintetica" };
    await assert.rejects(consumer.consultarCupom(url, "sintetica", input), error =>
      error.status === 422 && error.codigo === "pedido_invalido" && error.detalhe === "cupom_invalido" && error.requisicao === "req-sintetica");
    status = 200;
    answer = { dados: { ...success.dados, descontoCentavos: "100" } };
    await assert.rejects(consumer.consultarCupom(url, "sintetica", input), /INVALID_COUPON_RESPONSE/);
    answer = { erro: { codigo: "erro_interno", mensagem: "Erro" }, requisicao: "req" };
    await assert.rejects(consumer.consultarCupom(url, "sintetica", input), /INVALID_COUPON_RESPONSE/);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
