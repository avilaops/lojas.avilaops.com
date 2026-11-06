import assert from "node:assert/strict";
import { test } from "node:test";
import { ofertaMerchant, imagensMerchant } from "./merchant-schema";

const produto: { precoCentavos: number; precoDeCentavos: number | null; disponibilidade: string; estoque: number; sku: string } = { precoCentavos: 1000, precoDeCentavos: null, disponibilidade: "in_stock", estoque: 2, sku: "ABC" };
const politica = { "@id": "https://loja.test/politicas/devolucao#policy" };
function gerar(p = produto, presencial = false) {
  return ofertaMerchant(p, "https://loja.test/produtos/peca?variante=1", "https://loja.test/#organization", politica, presencial);
}

test("oferta preserva preço, moeda, variante, vendedor e devolução", () => {
  assert.deepEqual(gerar(), {
    "@type": "Offer", url: "https://loja.test/produtos/peca?variante=1",
    priceCurrency: "BRL", price: "10.00", sku: "ABC",
    itemCondition: "https://schema.org/NewCondition",
    availability: "https://schema.org/InStock",
    seller: { "@id": "https://loja.test/#organization" },
    hasMerchantReturnPolicy: politica,
  });
});

test("promoção informa preço anterior sem marcar o preço ativo como tachado", () => {
  const oferta = gerar({ ...produto, precoDeCentavos: 1500 });
  assert.equal(oferta?.price, "10.00");
  assert.deepEqual(oferta?.priceSpecification, {
    "@type": "UnitPriceSpecification", priceType: "https://schema.org/StrikethroughPrice",
    price: "15.00", priceCurrency: "BRL",
  });
});

test("não inventa desconto quando preço anterior é menor ou igual", () => {
  for (const precoDeCentavos of [500, 1000]) {
    assert.equal(gerar({ ...produto, precoDeCentavos })?.priceSpecification, undefined);
  }
});

test("recusa preço zero, negativo, fracionário ou não finito", () => {
  for (const precoCentavos of [0, -1, 1.5, NaN, Infinity]) assert.equal(gerar({ ...produto, precoCentavos }), undefined);
});

test("estoque zerado e venda presencial mantêm disponibilidade verdadeira", () => {
  assert.equal(gerar({ ...produto, estoque: 0 })?.availability, "https://schema.org/OutOfStock");
  assert.equal(gerar(produto, true)?.availability, "https://schema.org/InStoreOnly");
});

test("SKU com espaço não é publicado", () => {
  assert.equal(gerar({ ...produto, sku: "ABC 123" })?.sku, undefined);
});

test("imagens são absolutas, únicas e somente HTTP ou HTTPS", () => {
  assert.deepEqual(imagensMerchant(["/foto.jpg", "https://loja.test/foto.jpg", "", "javascript:alert(1)", "data:image/png;base64,x", "https://cdn.test/outra.jpg"], "https://loja.test"), [
    "https://loja.test/foto.jpg", "https://cdn.test/outra.jpg",
  ]);
});
