import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Consentimento, { PreferenciasCookies } from "../components/Consentimento";

test("HTML inicial não abre painel de cookies e mantém acesso manual no rodapé", () => {
  assert.equal(renderToStaticMarkup(createElement(Consentimento, { ativo: true, plataforma: true })), "");
  assert.match(renderToStaticMarkup(createElement(PreferenciasCookies)), /Preferências de cookies/);
});
