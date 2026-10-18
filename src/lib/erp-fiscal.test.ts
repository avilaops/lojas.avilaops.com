import assert from "node:assert/strict";
import test from "node:test";
import { baixarFiscalErp, buscarFiscalErp, fiscalErpConfigurado } from "./erp-fiscal";

const ENV = { NODE_ENV: "production", ERP_API_URL: "https://erp.exemplo.test/", ERP_APP_URL: "https://erp.exemplo.test/", ERP_API_KEYS_BY_CNPJ: JSON.stringify({ "60067738000106": "segredo" }) };

test("consulta fiscal do ERP usa a chave apenas no servidor e devolve o endereço operacional", async () => {
  let authorization = "";
  const fetcher = (async (_url: string | URL | Request, init?: RequestInit) => { authorization = new Headers(init?.headers).get("authorization") ?? ""; return Response.json({ notas: [{ id: 7, chave: "1".repeat(44), numero: 12, serie: 1, emitida_em: "2026-10-18T12:00:00-03:00", valor: 99.9, itens: 2, compra_id: null, fornecedor: { documento: "123", nome: "Fornecedor", vinculado: false, id: null } }] }); }) as typeof fetch;
  const result = await buscarFiscalErp("60067738000106", fetcher, ENV);
  assert.equal(authorization, "Bearer segredo");
  assert.deepEqual([result?.notas[0].id, result?.painelUrl], [7, "https://erp.exemplo.test/fiscal?ver=recebidas"]);
});

test("identifica configuração por CNPJ e rejeita resposta fiscal incompleta", async () => {
  assert.equal(fiscalErpConfigurado("60.067.738/0001-06", ENV), true);
  await assert.rejects(() => buscarFiscalErp("60067738000106", (async () => Response.json({ notas: [{ id: 7 }] })) as typeof fetch, ENV), /lista fiscal inválida/);
});

test("sem chave da empresa não consulta; download aceita só id e formato fechados", async () => {
  let calls = 0;
  const fetcher = (async () => { calls += 1; return new Response("ok"); }) as typeof fetch;
  assert.equal(await buscarFiscalErp("11111111111111", fetcher, ENV), null);
  assert.equal(await baixarFiscalErp("60067738000106", "../1", "xml", fetcher, ENV), null);
  assert.equal(calls, 0);
  assert.equal((await baixarFiscalErp("60067738000106", "7", "danfe", fetcher, ENV))?.status, 200);
  assert.equal(calls, 1);
});
