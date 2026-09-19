import assert from "node:assert/strict";
import test from "node:test";
import {
  casarAnuncioComCatalogo,
  proporAdocao,
  skusDoAnuncio,
  type ItemDoVendedor,
  type ProdutoDoCatalogo,
} from "./mercadolivre-adocao";

/**
 * Reconhecer o que o lojista já vende no Mercado Livre.
 *
 * O que está preso aqui é a prudência: vincular um anúncio entrega a ele o
 * preço e o estoque da loja, e o ciclo seguinte manda os nossos por cima dos
 * dele. Um casamento errado não erra uma tela — muda preço de venda de um
 * produto que não é aquele.
 */

const CATALOGO: ProdutoDoCatalogo[] = [
  {
    produtoId: "p-correia",
    nome: "Correia de transmissão 5PK 1230",
    sku: "COR-5PK-1230",
    gtin: "7891234567895",
    precoCentavos: 4990,
    estoque: 12,
    variantes: [],
  },
  {
    produtoId: "p-camiseta",
    nome: "Camiseta básica",
    sku: null,
    gtin: null,
    precoCentavos: 5990,
    estoque: 8,
    variantes: [
      { sku: "CAM-P", gtin: "7890000000017" },
      { sku: "CAM-G", gtin: null },
    ],
  },
  {
    produtoId: "p-outra-correia",
    nome: "Correia de transmissão 5PK 1235",
    sku: "COR-5PK-1235",
    gtin: null,
    precoCentavos: 5290,
    estoque: 3,
    variantes: [],
  },
];

const item = (p: Partial<ItemDoVendedor> = {}): ItemDoVendedor => ({
  id: p.id ?? "MLB123",
  title: p.title ?? "Correia",
  price: p.price,
  available_quantity: p.available_quantity,
  seller_custom_field: p.seller_custom_field ?? null,
  attributes: p.attributes ?? null,
  variations: p.variations ?? null,
  ...p,
});

test("o SKU do anúncio encontra o produto, sem depender de caixa ou espaço", () => {
  const r = casarAnuncioComCatalogo(item({ seller_custom_field: "  cor-5pk-1230 " }), CATALOGO);
  assert.equal(r?.produtoId, "p-correia");
  assert.equal(r?.por, "sku");
});

test("o SKU de uma variação também vale, porque é lá que ele costuma estar", () => {
  const r = casarAnuncioComCatalogo(item({ variations: [{ id: 1, seller_custom_field: "CAM-G" }] }), CATALOGO);
  assert.equal(r?.produtoId, "p-camiseta");
});

test("GTIN casa com hífen, sem hífen, tanto faz: é o mesmo código de barras", () => {
  const r = casarAnuncioComCatalogo(item({ attributes: [{ id: "GTIN", value_name: "789-123456-7895" }] }), CATALOGO);
  assert.equal(r?.produtoId, "p-correia");
  assert.equal(r?.por, "gtin");
  assert.equal(r?.valor, "7891234567895");
});

test("SKU manda mais que GTIN quando os dois apontam para lugares diferentes", () => {
  // O SKU é escrito pelo lojista para o produto dele; o GTIN é do fabricante e
  // pode se repetir entre revendas. Na dúvida, vale o que ele mesmo escreveu.
  const r = casarAnuncioComCatalogo(
    item({ seller_custom_field: "CAM-P", attributes: [{ id: "GTIN", value_name: "7891234567895" }] }),
    CATALOGO,
  );
  assert.equal(r?.produtoId, "p-camiseta");
  assert.equal(r?.por, "sku");
});

test("título parecido não casa — é exatamente o erro caro", () => {
  // "Correia de transmissão 5PK 1230" e "…1235" são dois produtos. Casar por
  // nome mandaria o preço de um para o anúncio do outro no ciclo seguinte.
  const r = casarAnuncioComCatalogo(item({ title: "Correia de transmissão 5PK 1230" }), CATALOGO);
  assert.equal(r, null);
});

test("SKU repetido no catálogo não é escolha por sorteio", () => {
  const ambiguo: ProdutoDoCatalogo[] = [
    { produtoId: "a", nome: "A", sku: "IGUAL", gtin: null, precoCentavos: 100, estoque: 1, variantes: [] },
    { produtoId: "b", nome: "B", sku: "IGUAL", gtin: null, precoCentavos: 200, estoque: 1, variantes: [] },
  ];
  assert.equal(casarAnuncioComCatalogo(item({ seller_custom_field: "IGUAL" }), ambiguo), null);
});

test("GTIN curto demais não é GTIN", () => {
  const r = casarAnuncioComCatalogo(item({ attributes: [{ id: "GTIN", value_name: "123" }] }), CATALOGO);
  assert.equal(r, null);
});

test("anúncio sem identificador nenhum fica sem casamento, e isso é o certo", () => {
  assert.equal(casarAnuncioComCatalogo(item(), CATALOGO), null);
});

test("os SKUs do anúncio saem sem repetição e sem vazio", () => {
  const s = skusDoAnuncio(
    item({
      seller_custom_field: "A",
      attributes: [{ id: "SELLER_SKU", value_name: "a" }],
      variations: [{ id: 1, seller_custom_field: "B" }, { id: 2, seller_custom_field: "  " }],
    }),
  );
  assert.deepEqual(s, ["A", "B"]);
});

test("a proposta mostra o que mudaria, para o sim não ser cego", () => {
  const p = proporAdocao(
    item({ id: "MLB9", title: "Correia 5PK", seller_custom_field: "COR-5PK-1230", price: 59.9, available_quantity: 4 }),
    CATALOGO,
  );
  assert.equal(p.casamento?.produtoId, "p-correia");
  assert.equal(p.produtoNome, "Correia de transmissão 5PK 1230");
  // Está a R$ 59,90 com 4 no ML; a loja mandaria R$ 49,90 e 12.
  assert.equal(p.precoCentavos, 5990);
  assert.equal(p.estoque, 4);
  assert.deepEqual(p.mudaria, { precoCentavos: 4990, estoque: 12 });
});

test("proposta sem casamento não inventa o que mudaria", () => {
  const p = proporAdocao(item({ id: "MLB9", price: 10 }), CATALOGO);
  assert.equal(p.casamento, null);
  assert.equal(p.produtoNome, null);
  assert.equal(p.mudaria, null);
});

test("centavos não escorregam no float", () => {
  assert.equal(proporAdocao(item({ price: 0.29 }), CATALOGO).precoCentavos, 29);
  assert.equal(proporAdocao(item({ price: 1234.56 }), CATALOGO).precoCentavos, 123456);
});
