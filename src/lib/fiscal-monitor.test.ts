import assert from "node:assert/strict";
import test from "node:test";
import { separarDocumentosFiscais, totalizarDocumentosFiscais } from "./fiscal-monitor";

test("separa NF-e dos eventos para que eventos recentes nao escondam as notas", () => {
  const documentos = [
    { id: "evento-1", schema: "resEvento_v1.01.xsd" },
    { id: "nota-1", schema: "resNFe_v1.01.xsd" },
    { id: "evento-2", schema: "procEventoNFe_v1.00.xsd" },
    { id: "nota-2", schema: "procNFe_v4.00.xsd" },
  ];

  const resultado = separarDocumentosFiscais(documentos);

  assert.deepEqual(resultado.notas.map((documento) => documento.id), ["nota-1", "nota-2"]);
  assert.deepEqual(resultado.eventos.map((documento) => documento.id), ["evento-1", "evento-2"]);
});

test("mantem documentos desconhecidos separados das NF-e", () => {
  const resultado = separarDocumentosFiscais([{ id: "outro-1", schema: "cteProc_v4.00.xsd" }]);

  assert.deepEqual(resultado.notas, []);
  assert.deepEqual(resultado.eventos, []);
  assert.deepEqual(resultado.outros.map((documento) => documento.id), ["outro-1"]);
});

test("totaliza todo o histórico por schema sem confundir a amostra exibida", () => {
  assert.deepEqual(totalizarDocumentosFiscais([
    { schema: "resNFe_v1.01.xsd", quantidade: 6 },
    { schema: "procNFe_v4.00.xsd", quantidade: 2 },
    { schema: "resEvento_v1.01.xsd", quantidade: 78 },
    { schema: "procEventoNFe_v1.00.xsd", quantidade: 43 },
    { schema: "cteProc_v4.00.xsd", quantidade: 1 },
  ]), { documentos: 130, notas: 8, eventos: 121, outros: 1 });
});
