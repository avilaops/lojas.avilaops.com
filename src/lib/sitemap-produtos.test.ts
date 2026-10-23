import assert from "node:assert/strict";
import test from "node:test";
import { paginarProdutosDoSitemap } from "./sitemap-produtos";

test("pagina um catálogo grande sem perder nem repetir produtos", async () => {
  const catalogo = Array.from({ length: 8_426 }, (_, i) => ({ id: `p-${String(i).padStart(5, "0")}` }));
  const cursores: Array<string | undefined> = [];

  const produtos = await paginarProdutosDoSitemap(async ({ cursor, limite }) => {
    cursores.push(cursor);
    const inicio = cursor == null ? 0 : catalogo.findIndex((p) => p.id === cursor) + 1;
    return catalogo.slice(inicio, inicio + limite);
  });

  assert.equal(produtos.length, 8_426);
  assert.equal(new Set(produtos.map((p) => p.id)).size, 8_426);
  assert.deepEqual(cursores, [undefined, "p-00999", "p-01999", "p-02999", "p-03999", "p-04999", "p-05999", "p-06999", "p-07999"]);
});

test("encerra sem nova consulta quando a última página vem incompleta", async () => {
  let chamadas = 0;
  const produtos = await paginarProdutosDoSitemap(async () => {
    chamadas += 1;
    return [{ id: "unico" }];
  });

  assert.deepEqual(produtos, [{ id: "unico" }]);
  assert.equal(chamadas, 1);
});
