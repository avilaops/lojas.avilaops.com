import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import FichaTecnica from "@/components/FichaTecnica";

test("a ficha renderizada omite metadados de integração e mantém características reais", () => {
  const html = renderToStaticMarkup(createElement(FichaTecnica, {
    atributos: {
      VEHICLE_TYPE: "Carro/Caminhonete",
      UNITS_PER_PACK: "1",
      categoriaGoogle: "888",
      ncm: "34025000",
      modoDeUso: "Aplicar na superfície fria.",
      volumeMl: 500,
    },
  }));

  assert.doesNotMatch(html, /Vehicle|Units per pack|Categoria google|888/);
  assert.match(html, /NCM/);
  assert.match(html, /Modo de uso/);
  assert.match(html, /Volume \(ml\)/);
});
