import assert from "node:assert/strict";
import test from "node:test";
import { chaveDemandaPk, normalizarDemandaPk } from "./pk-demanda-busca";

test("normaliza apenas consultas técnicas fechadas", () => {
  assert.deepEqual(normalizarDemandaPk("  Gaxeta   NBR "), { tipo: "familia-material", consulta: "gaxeta nbr" });
  assert.deepEqual(normalizarDemandaPk("20,5 × 30 x 4 mm"), { tipo: "medidas", consulta: "20.5 x 30 x 4 mm" });
  assert.deepEqual(normalizarDemandaPk("GNY-5030"), { tipo: "codigo", consulta: "GNY-5030" });
  assert.deepEqual(normalizarDemandaPk("123456"), { tipo: "codigo", consulta: "123456" });
});
test("rejeita PII, mensagens e medidas inválidas sem extrair trechos", () => {
  for (const entrada of ["nome@email.com", "11999998888", "11 99999-8888", "+55 (11) 99999-8888", "João", "joao123", "preciso gaxeta nbr", "gaxeta para joao", "20 x 30 obrigado", "0 x 30", "3001 x 20", "1234567", "12", "20/30", "", null, {}, "anel\nnome"]) assert.equal(normalizarDemandaPk(entrada), null, String(entrada));
});
test("normalização é idempotente para transmissão e revalidação", () => {
  for (const entrada of ["20,5 × 30 x 4 mm", "GNY-5030", "gaxeta nbr", "123456"]) {
    const resultado = normalizarDemandaPk(entrada)!;
    assert.deepEqual(normalizarDemandaPk(resultado.consulta), resultado);
  }
});
test("chave agrega por tenant, consulta, tipo e dia local sem visitante", () => {
  const a = chaveDemandaPk("pk-1", "pkvedacoes", "GAXETA NBR", new Date("2026-11-08T02:00:00Z"))!;
  assert.equal(a.dia.toISOString(), "2026-11-07T00:00:00.000Z");
  assert.deepEqual(a, chaveDemandaPk("pk-1", "pkvedacoes", "gaxeta nbr", new Date("2026-11-08T01:00:00Z")));
  assert.equal(chaveDemandaPk("outra", "outra-loja", "gaxeta nbr"), null);
  assert.notDeepEqual(a, chaveDemandaPk("pk-2", "pkvedacoes", "gaxeta nbr", new Date("2026-11-08T01:00:00Z")));
  assert.deepEqual(Object.keys(a).sort(), ["consulta", "dia", "tenantId", "tipo"]);
});
