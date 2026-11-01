import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ConfiguradorClient from "@/app/configurador/ConfiguradorClient";

test("configurador oferece retomada por código sem preencher contato antigo", () => {
  const html = renderToStaticMarkup(createElement(ConfiguradorClient, {
    nomeDaLoja: "MRG Caixas Térmicas",
    slugDaLoja: "mrg-caixas-termicas",
    whatsapp: null,
  }));

  assert.match(html, /Retomar uma configuração/);
  assert.match(html, /Código privado de retomada/);
  assert.match(html, /Observações e dados de contato não são recuperados/);
  assert.doesNotMatch(html, /value="maria@example\.com"/);
});
