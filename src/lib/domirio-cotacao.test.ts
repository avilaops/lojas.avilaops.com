import test from "node:test";
import assert from "node:assert/strict";
import { adicionarLinhaDomiRio, restaurarListaDomiRio, mensagemListaDomiRio, importarCarrinhoDomiRio, type OfertaCotacaoDomiRio } from "./domirio-cotacao";

const ofertas: OfertaCotacaoDomiRio[] = [
  { id: "p:v1", produtoId: "p", slug: "cypertryne", nome: "Cypertryne", sku: "ISO015", apresentacao: "1 L", varianteId: "v1", padrao: false, estoque: 2, disponivel: true },
  { id: "s:v2", produtoId: "s", slug: "sanepec", nome: "Sanepec", sku: "ISO276", apresentacao: "100 mL", varianteId: "v2", padrao: true, estoque: 30, disponivel: true },
];
test("lista soma repetidos sem alterar a entrada e recusa quantidades inválidas", () => {
  const antes = [{ id: "p:v1", quantidade: 2 }];
  assert.deepEqual(adicionarLinhaDomiRio(antes, "p:v1", 3), [{ id: "p:v1", quantidade: 5 }]);
  assert.equal(antes[0].quantidade, 2);
  for (const n of [0, -1, 1.5, NaN, 100000]) assert.throws(() => adicionarLinhaDomiRio([], "p:v1", n));
  assert.throws(() => adicionarLinhaDomiRio([{ id: "p:v1", quantidade: 99999 }], "p:v1", 1));
});
test("restauração não aceita dados estranhos, itens removidos ou outra loja", () => {
  assert.deepEqual(restaurarListaDomiRio([{ id: "outra:v", quantidade: 2 }, { id: "p:v1", quantidade: 3 }, { id: "s:v2", quantidade: -3 }], ofertas), [{ id: "p:v1", quantidade: 3 }]);
  assert.deepEqual(restaurarListaDomiRio({ itens: [] }, ofertas), []);
});
test("importação resolve o produto simples e preserva variante explícita", () => {
  assert.deepEqual(importarCarrinhoDomiRio([{ id: "s", quantidade: 4 }, { id: "p:v1", quantidade: 5 }, { id: "inexistente", quantidade: 1 }], ofertas), [{ id: "s:v2", quantidade: 4 }, { id: "p:v1", quantidade: 5 }]);
});
test("mensagem contém código e variante corretos, CEP opcional e saldo a confirmar", () => {
  const texto = mensagemListaDomiRio([{ id: "p:v1", quantidade: 12 }, { id: "s:v2", quantidade: 3 }], ofertas, "https://domiriodistribuidora.com.br", "15000-000");
  assert.match(texto, /ISO015/); assert.match(texto, /1 L/); assert.match(texto, /12 unidades/);
  assert.match(texto, /variante=v1/); assert.match(texto, /confirmar disponibilidade/i);
  assert.match(texto, /15000-000/); assert.doesNotMatch(texto, /Total:|R\$/);
  assert.throws(() => mensagemListaDomiRio([], ofertas, "https://loja.test"));
  assert.throws(() => mensagemListaDomiRio([{ id: "outra:v", quantidade: 2 }], ofertas, "https://loja.test"));
  assert.throws(() => mensagemListaDomiRio([{ id: "p:v1", quantidade: 1 }], ofertas, "https://loja.test", "inválido"));
});

test("limites impedem excesso de apresentações e mensagens longas", () => {
  const lista = Array.from({ length: 50 }, (_, i) => ({ id: `p:${i}`, quantidade: 1 }));
  assert.throws(() => adicionarLinhaDomiRio(lista, "p:51", 1));
  const longas = lista.map(l => ({ ...ofertas[0], id: l.id, nome: "Produto ".repeat(100) }));
  assert.throws(() => mensagemListaDomiRio(lista, longas, "https://loja.test"), /Divida em duas/);
});
