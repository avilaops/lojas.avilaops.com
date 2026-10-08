import assert from "node:assert/strict";
import test from "node:test";
import { extrairPreCargas } from "./fontes-pre-carga";

const face = (familia: string, peso: string, arquivo: string, faixa: string, estilo = "normal") =>
  `@font-face{font-family:${familia};font-style:${estilo};font-weight:${peso};font-display:swap;src:url(../media/${arquivo})format("woff2");unicode-range:${faixa}}`;

test("pré-carrega só o recorte latino da família, nos pesos 400 e 700", () => {
  const css = [
    face("Poppins", "400", "devanagari.woff2", "U+900-97F"),
    face("Poppins", "400", "latino-400.woff2", "U+??,U+131"),
    face("Poppins", "600", "latino-600.woff2", "U+??,U+131"),
    face("Poppins", "700", "latino-700.woff2", "U+0000-00FF,U+131"),
    face("Poppins", "400", "italico.woff2", "U+??", "italic"),
    face("Inter", "400", "inter.woff2", "U+??"),
  ].join("");
  assert.deepEqual(extrairPreCargas(css, "Poppins"), ["/_next/static/media/latino-400.woff2", "/_next/static/media/latino-700.woff2"]);
});

test("fonte variável entra uma vez, e família ausente não devolve nada", () => {
  const css = face("Inter", "100 900", "inter-var.woff2", "U+??,U+131");
  assert.deepEqual(extrairPreCargas(css, "Inter"), ["/_next/static/media/inter-var.woff2"]);
  assert.deepEqual(extrairPreCargas(css, "Montserrat"), []);
});
