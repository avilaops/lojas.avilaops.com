import assert from "node:assert/strict";
import test from "node:test";
import { gerarDanfeCompartilhado } from "./fiscal-danfe-compartilhado";
import { responderDownloadDanfeFiscal, responderDownloadFiscalErp, responderDownloadXmlFiscal } from "./fiscal-download";

const XML_COMPLETO = "<nfeProc xmlns=\"http://www.portalfiscal.inf.br/nfe\"><NFe><infNFe Id=\"NFe" + "1".repeat(44) + "\"><ide><mod>55</mod></ide></infNFe></NFe><protNFe><infProt><cStat>100</cStat></infProt></protNFe></nfeProc>";
const PDF = new TextEncoder().encode("%PDF-1.7\n%%EOF");
const DOCUMENTO = {
  id: "doc-1",
  cnpj: "60067738000106",
  nsu: "000000000000001",
  schema: "procNFe_v4.00.xsd",
  chave: "1".repeat(44),
  xml: XML_COMPLETO,
  arquivadoEm: null,
};

function dependencias(documento: typeof DOCUMENTO | null = DOCUMENTO) {
  return {
    buscarDocumento: async (tenantId: string, id: string) => tenantId === "tenant-1" && id === "doc-1" ? documento : null,
    lerArquivo: async () => null,
    guardarArquivo: async () => true,
    gerarDanfe: async () => PDF,
  };
}

test("download XML entrega somente o procNFe integral do tenant", async () => {
  const resposta = await responderDownloadXmlFiscal("tenant-1", "doc-1", dependencias());
  assert.equal(resposta.status, 200);
  assert.equal(resposta.headers.get("content-type"), "application/xml; charset=utf-8");
  assert.match(resposta.headers.get("content-disposition") ?? "", /^attachment; filename="NFe-/);
  assert.equal(resposta.headers.get("cache-control"), "private, no-store");
  assert.equal(resposta.headers.get("x-content-type-options"), "nosniff");
  assert.equal(await resposta.text(), XML_COMPLETO);

  assert.equal((await responderDownloadXmlFiscal("tenant-2", "doc-1", dependencias())).status, 404);
  assert.equal((await responderDownloadXmlFiscal("tenant-1", "inexistente", dependencias())).status, 404);
});

test("resumo fiscal nunca é servido como XML completo nem usado para DANFE", async () => {
  const resumo = { ...DOCUMENTO, schema: "resNFe_v1.01.xsd", xml: "<resNFe><chNFe>" + "1".repeat(44) + "</chNFe></resNFe>" };
  assert.equal((await responderDownloadXmlFiscal("tenant-1", "doc-1", dependencias(resumo))).status, 409);
  assert.equal((await responderDownloadDanfeFiscal("tenant-1", "doc-1", dependencias(resumo))).status, 409);

  const rejeitado = { ...DOCUMENTO, xml: XML_COMPLETO.replace("<cStat>100</cStat>", "<cStat>110</cStat>") };
  assert.equal((await responderDownloadXmlFiscal("tenant-1", "doc-1", dependencias(rejeitado))).status, 409);
});

test("DANFE válido mantém cabeçalhos privados e cache indisponível não impede download", async () => {
  const resposta = await responderDownloadDanfeFiscal("tenant-1", "doc-1", {
    ...dependencias(),
    lerArquivo: async () => { throw new Error("R2 indisponível"); },
    guardarArquivo: async () => { throw new Error("R2 indisponível"); },
  });
  assert.equal(resposta.status, 200);
  assert.equal(resposta.headers.get("content-type"), "application/pdf");
  assert.equal(resposta.headers.get("cache-control"), "private, no-store");
  assert.equal(new TextDecoder().decode((await resposta.bytes()).slice(0, 5)), "%PDF-");
});

test("DANFE sem serviço e resposta inválida falham de forma controlada", async () => {
  assert.equal((await responderDownloadDanfeFiscal("tenant-1", "doc-1", { ...dependencias(), gerarDanfe: async () => null })).status, 503);
  assert.equal((await responderDownloadDanfeFiscal("tenant-1", "doc-1", { ...dependencias(), gerarDanfe: async () => new TextEncoder().encode("erro") })).status, 502);
});

test("proxy ERP valida formato, tipo e conteúdo antes de responder", async () => {
  const pdf = await responderDownloadFiscalErp("60067738000106", "7", "danfe", {
    baixarArquivo: async () => new Response(PDF, { headers: { "Content-Type": "application/pdf" } }),
  });
  assert.equal(pdf.status, 200);
  assert.equal(new TextDecoder().decode((await pdf.bytes()).slice(0, 5)), "%PDF-");

  const xml = await responderDownloadFiscalErp("60067738000106", "7", "xml", {
    baixarArquivo: async () => new Response(XML_COMPLETO, { headers: { "Content-Type": "application/xml" } }),
  });
  assert.equal(xml.status, 200);
  assert.equal(await xml.text(), XML_COMPLETO);

  assert.equal((await responderDownloadFiscalErp("60067738000106", "7", "zip", { baixarArquivo: async () => null })).status, 404);
  assert.equal((await responderDownloadFiscalErp("60067738000106", "7", "danfe", { baixarArquivo: async () => null })).status, 404);
  assert.equal((await responderDownloadFiscalErp("60067738000106", "7", "danfe", { baixarArquivo: async () => { throw new Error("rede"); } })).status, 502);
  assert.equal((await responderDownloadFiscalErp("60067738000106", "7", "danfe", { baixarArquivo: async () => new Response("erro", { status: 503 }) })).status, 503);
  assert.equal((await responderDownloadFiscalErp("60067738000106", "7", "danfe", { baixarArquivo: async () => new Response("não é PDF", { headers: { "Content-Type": "application/pdf" } }) })).status, 502);
  assert.equal((await responderDownloadFiscalErp("60067738000106", "7", "danfe", { baixarArquivo: async () => new Response(PDF, { headers: { "Content-Type": "application/json" } }) })).status, 502);
});

test("cliente do DANFE compartilhado exige configuração, tipo e assinatura válidos", async () => {
  assert.equal(await gerarDanfeCompartilhado(XML_COMPLETO, fetch, { NODE_ENV: "test" }), null);
  assert.equal(await gerarDanfeCompartilhado(XML_COMPLETO, fetch, { NODE_ENV: "production", FISCAL_SHARED_API_URL: "http://inseguro", FISCAL_SHARED_SERVICE_KEY: "x" }), null);

  let chave = "";
  const fetcher = (async (_url: string | URL | Request, init?: RequestInit) => {
    chave = new Headers(init?.headers).get("x-fiscal-service-key") ?? "";
    return new Response(PDF, { headers: { "Content-Type": "application/pdf" } });
  }) as typeof fetch;
  const arquivo = await gerarDanfeCompartilhado(XML_COMPLETO, fetcher, { NODE_ENV: "production", FISCAL_SHARED_API_URL: "http://fiscal-avilaops-com-web:8000", FISCAL_SHARED_SERVICE_KEY: "segredo" });
  assert.equal(chave, "segredo");
  assert.equal(new TextDecoder().decode(arquivo?.slice(0, 5)), "%PDF-");

  await assert.rejects(() => gerarDanfeCompartilhado(XML_COMPLETO, (async () => new Response(PDF, { headers: { "Content-Type": "application/json" } })) as typeof fetch, { NODE_ENV: "test", FISCAL_SHARED_API_URL: "https://fiscal.example", FISCAL_SHARED_SERVICE_KEY: "x" }), /Tipo do arquivo fiscal inválido/);
});
