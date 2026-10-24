import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import DownloadFiscal from "../components/painel/DownloadFiscal";

test("download fiscal usa ação controlada em vez de link direto para resposta de erro", () => {
  const html = renderToStaticMarkup(createElement(DownloadFiscal, {
    href: "/api/painel/fiscal/documentos/doc-1",
    fallback: "NFe-doc-1.xml",
    className: "btn-secundario",
    children: "XML",
  }));

  assert.match(html, /<button[^>]+type="button"/);
  assert.doesNotMatch(html, /href=/);
  assert.match(html, />XML<\/button>/);
});
