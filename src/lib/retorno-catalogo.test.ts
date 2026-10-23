import assert from "node:assert/strict";
import test from "node:test";
import { hrefDaVariante, hrefDoProduto, retornoDaListagem, retornoSeguroDoCatalogo } from "./retorno-catalogo";

test("listagem conserva busca, filtros, ordenação e página no retorno", () => {
  assert.equal(
    retornoDaListagem("/produtos", {
      q: "correia 3L",
      categoria: "correias",
      ordem: "menor-preco",
      pagina: "2",
      di_de: "20,5",
      lixo: "não entra",
    }),
    "/produtos?q=correia+3L&categoria=correias&ordem=menor-preco&pagina=2&di_de=20%2C5",
  );
});

test("categoria conserva somente parâmetros reconhecidos", () => {
  assert.equal(
    retornoDaListagem("/categoria/correias", { fabricante: "Gates", disponivel: "1", max: "100" }),
    "/categoria/correias?fabricante=Gates&disponivel=1&max=100",
  );
});

test("retorno aceita apenas listagens internas do catálogo", () => {
  assert.equal(retornoSeguroDoCatalogo("/produtos?q=6204"), "/produtos?q=6204");
  assert.equal(retornoSeguroDoCatalogo("/categoria/rolamentos?ordem=nome"), "/categoria/rolamentos?ordem=nome");
  for (const valor of [
    "https://evil.example/produtos",
    "//evil.example/produtos",
    "/checkout",
    "/categoria/../checkout",
    "javascript:alert(1)",
  ]) assert.equal(retornoSeguroDoCatalogo(valor), null, valor);
});

test("link do produto leva um retorno codificado e opcional", () => {
  assert.equal(hrefDoProduto("correia-3l300", "/produtos?q=3L300"), "/produtos/correia-3l300?voltar=%2Fprodutos%3Fq%3D3L300");
  assert.equal(hrefDoProduto("correia-3l300"), "/produtos/correia-3l300");
});

test("troca de variante não apaga o retorno à listagem", () => {
  assert.equal(
    hrefDaVariante("correia-3l300", "variante 42", "/categoria/correias?ordem=menor-preco"),
    "/produtos/correia-3l300?variante=variante+42&voltar=%2Fcategoria%2Fcorreias%3Fordem%3Dmenor-preco",
  );
});
