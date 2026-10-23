import assert from "node:assert/strict";
import { test } from "node:test";
import { filtrosFiscais } from "./fiscal-filtros";

test("monitor busca NF-e disponíveis em todas as páginas sem consultar SEFAZ", () => {
  const { where, pagina, limite } = filtrosFiscais("tenant-test", new URLSearchParams({ tipo: "nfe-recebidas", arquivos: "disponiveis", pagina: "2" }));
  assert.equal(where.tenantId, "tenant-test");
  assert.deepEqual(where.schema, { startsWith: "procNFe" });
  assert.equal(pagina, 2);
  assert.equal(limite, 30);
});

test("monitor completo mantém documentos conhecidos inclusive pendentes", () => {
  const { where } = filtrosFiscais("tenant-test", new URLSearchParams({ tipo: "nfe-recebidas", arquivos: "todos" }));
  assert.equal(where.tenantId, "tenant-test");
  assert.ok(Array.isArray(where.OR));
});
