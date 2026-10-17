import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { comprar, entradasDoDataLayer, paraGa4, receitaDosItens, verProduto } from "./eventos-loja";
import { scriptInicialDoGoogle } from "./pixels";

const itens = [
  { id: "p1", nome: "Shampoo 1,5 L", precoCentavos: 4990, quantidade: 2, categoria: "Lavagem" },
  { id: "p2", nome: "Boina 6 pol", precoCentavos: 2500 },
];

test("o dataLayer recebe o evento no formato de e-commerce do GA4, com o reset antes", () => {
  const entradas = entradasDoDataLayer("purchase", itens, 12480, { transacao: "PED-1", frete: 2500 });
  assert.equal(entradas.length, 2);
  // Sem o `ecommerce: null`, o GTM mescla os itens do evento anterior.
  assert.deepEqual(entradas[0], { ecommerce: null });
  assert.deepEqual(entradas[1], {
    event: "purchase",
    ecommerce: {
      currency: "BRL",
      value: 124.8,
      transaction_id: "PED-1",
      shipping: 25,
      items: [
        { item_id: "p1", item_name: "Shampoo 1,5 L", price: 49.9, quantity: 2, item_category: "Lavagem" },
        { item_id: "p2", item_name: "Boina 6 pol", price: 25, quantity: 1, item_category: undefined },
      ],
    },
  });
});

test("evento sem transação não inventa transaction_id nem frete", () => {
  const [, evento] = entradasDoDataLayer("add_to_cart", [itens[1]], 2500) as [unknown, { ecommerce: Record<string, unknown> }];
  assert.equal("transaction_id" in evento.ecommerce, false);
  assert.equal("shipping" in evento.ecommerce, false);
  assert.deepEqual(evento.ecommerce.items, paraGa4([itens[1]]));
});

test("o value da compra é a receita dos itens: o frete sai e vai só em shipping", () => {
  // Pedido de R$ 124,80 com R$ 25,00 de frete: value 99,80, shipping 25.
  assert.equal(receitaDosItens(12480, 2500), 9980);
  assert.equal(receitaDosItens(12480, 0), 12480);
  // Frete negativo ou maior que o total não produz receita negativa.
  assert.equal(receitaDosItens(1000, -500), 1000);
  assert.equal(receitaDosItens(1000, 5000), 0);
});

/**
 * A página como o navegador a vê logo depois do HTML: só o script em linha de
 * `Pixels.tsx` rodou. Os loaders do GTM e do gtag.js são `afterInteractive` e
 * ainda não chegaram, que é o momento em que o `view_item` da página do
 * produto dispara.
 */
function paginaRecemAberta(gtmId: string | null) {
  const janela: Record<string, unknown> = {};
  janela.window = janela;
  const guardado = new Map<string, string>();
  janela.sessionStorage = { getItem: (k: string) => guardado.get(k) ?? null, setItem: (k: string, v: string) => void guardado.set(k, v) };
  vm.runInNewContext(scriptInicialDoGoogle({ gtmId }), janela);
  (globalThis as { window?: unknown }).window = janela;
  return janela as { dataLayer: unknown[] };
}

/** Separa o que o GTM lê (objeto com `event`) do que o gtag empurra (`arguments`). */
function lidoDoDataLayer(dataLayer: unknown[]) {
  const objetos: Record<string, unknown>[] = [];
  const comandos: unknown[][] = [];
  for (const entrada of dataLayer) {
    if (Object.prototype.toString.call(entrada) === "[object Arguments]") comandos.push(Array.from(entrada as ArrayLike<unknown>));
    else objetos.push(entrada as Record<string, unknown>);
  }
  return { objetos, comandos, eventos: objetos.filter((o) => typeof o.event === "string").map((o) => o.event) };
}

const produto = { id: "p1", nome: "Shampoo 1,5 L", precoCentavos: 4990 };

test("view_item na hidratação já encontra o marcador: loja com GTM recebe no dataLayer, depois do consent default", (t) => {
  t.after(() => void delete (globalThis as { window?: unknown }).window);
  const w = paginaRecemAberta("GTM-ABC123");
  verProduto(produto);

  // O consentimento negado é o primeiro comando da fila; o evento vem depois.
  assert.equal(Object.prototype.toString.call(w.dataLayer[0]), "[object Arguments]");
  const { comandos, eventos } = lidoDoDataLayer(w.dataLayer);
  assert.deepEqual(comandos[0].slice(0, 2), ["consent", "default"]);
  assert.deepEqual(eventos, ["view_item"]);
  // O reset de `ecommerce` fica imediatamente antes do evento.
  const posicao = w.dataLayer.findIndex((e) => (e as { event?: string }).event === "view_item");
  assert.deepEqual(w.dataLayer[posicao - 1], { ecommerce: null });
});

test("loja com GTM não recebe o mesmo evento também por gtag, nem a conversão do Ads", (t) => {
  t.after(() => void delete (globalThis as { window?: unknown }).window);
  const w = paginaRecemAberta("GTM-ABC123");
  verProduto(produto);
  const dados = { totalCentavos: 7490, freteCentavos: 2500, referencia: "PED-9", googleAdsId: "AW-123", rotuloCompra: "abc" };
  comprar([produto], dados);
  comprar([produto], dados); // recarregar a página do pedido não conta de novo

  const { comandos, objetos, eventos } = lidoDoDataLayer(w.dataLayer);
  assert.deepEqual(eventos, ["view_item", "purchase"]);
  assert.deepEqual(comandos.filter((c) => c[0] === "event"), [], "com GTM, nenhum gtag('event') entra na fila");
  const compra = objetos.find((o) => o.event === "purchase") as { ecommerce: Record<string, unknown> };
  assert.equal(compra.ecommerce.value, 49.9);
  assert.equal(compra.ecommerce.shipping, 25);
  assert.equal(compra.ecommerce.transaction_id, "PED-9");
});

test("loja sem GTM mede só pelo gtag: um evento por fato e nenhum objeto de e-commerce no dataLayer", (t) => {
  t.after(() => void delete (globalThis as { window?: unknown }).window);
  const w = paginaRecemAberta(null);
  verProduto(produto);
  comprar([produto], { totalCentavos: 7490, freteCentavos: 2500, referencia: "PED-10", googleAdsId: "AW-123", rotuloCompra: "abc" });

  const { comandos, objetos } = lidoDoDataLayer(w.dataLayer);
  assert.deepEqual(objetos, []);
  assert.deepEqual(comandos.filter((c) => c[0] === "event").map((c) => c[1]), ["view_item", "purchase", "conversion"]);
  const conversao = comandos.find((c) => c[1] === "conversion") as [string, string, Record<string, unknown>];
  assert.equal(conversao[2].send_to, "AW-123/abc");
  assert.equal(conversao[2].value, 49.9);
});
