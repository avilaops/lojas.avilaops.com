import assert from "node:assert/strict";
import test from "node:test";
import { deduplicarDocumentosFiscais, type DocumentoDaListaFiscal } from "./fiscal-lista";

const documento = (dados: Partial<DocumentoDaListaFiscal> = {}): DocumentoDaListaFiscal => ({
  id: "resumo-1",
  chave: "35261067554083000131550010000004641000004640",
  nsu: "10",
  tipo: "NFE",
  situacao: "RESUMO",
  completoId: null,
  recebidoEm: "2026-10-24T10:00:00-03:00",
  ...dados,
});

test("remove repetições da mesma identidade fiscal", () => {
  const repetido = documento();
  assert.deepEqual(deduplicarDocumentosFiscais([repetido, repetido]), [repetido]);
});

test("prioriza o XML completo quando resumo e documento compartilham a chave", () => {
  const resumo = documento();
  const completo = documento({ id: "completo-1", nsu: "11", situacao: "COMPLETA" });
  assert.deepEqual(deduplicarDocumentosFiscais([resumo, completo]), [completo]);
});

test("preserva documentos sem chave com NSU diferentes", () => {
  const primeiro = documento({ id: "a", chave: null, nsu: "20" });
  const segundo = documento({ id: "b", chave: null, nsu: "21" });
  assert.deepEqual(deduplicarDocumentosFiscais([primeiro, segundo]), [primeiro, segundo]);
});
