import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { proxy } from "../proxy";
import { destinoLegado } from "./redirects-legados";

test("URLs antigas verificadas apontam direto para destinos atuais", () => {
  assert.equal(
    destinoLegado("vedashow.com.br", "/detalhe-produto/2408-uc209-rolamento"),
    "/produtos?q=UC209",
  );
  assert.equal(destinoLegado("vedashow.com.br", "/loja-grupo-produtos/3"), "/produtos");
});

test("redirects da VedaShow não vazam para outro tenant nem capturam rota desconhecida", () => {
  assert.equal(destinoLegado("outra-loja.com.br", "/loja-grupo-produtos/3"), null);
  assert.equal(destinoLegado("vedashow.com.br", "/loja-grupo-produtos/4"), null);
});

test("www e query chegam ao destino final sem cadeia de redirects", () => {
  const request = new NextRequest(
    "https://www.vedashow.com.br/detalhe-produto/2408-uc209-rolamento?utm_source=google",
  );

  const response = proxy(request);

  assert.equal(response.status, 308);
  assert.equal(
    response.headers.get("location"),
    "https://vedashow.com.br/produtos?q=UC209&utm_source=google",
  );
});
