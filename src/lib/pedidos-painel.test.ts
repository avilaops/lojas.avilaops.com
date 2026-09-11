import assert from "node:assert/strict";
import test from "node:test";
import { filtroDePedidos, paginaValida } from "./pedidos-painel";

/**
 * Isolamento entre lojas: o `tenantId` da sessão está em toda consulta, seja
 * qual for a busca. É a única garantia que impede um lojista de listar o
 * pedido de outra loja trocando parâmetros da URL.
 */
const LOJA = "tenant_a";

test("toda forma de busca sai com o tenantId da sessão", () => {
  for (const q of [undefined, "", "47", "#47", "ronaldo", "16993148630", "abc@x.com"]) {
    for (const situacao of [undefined, "", "PAGO", "INVENTADA"]) {
      const w = filtroDePedidos({ tenantId: LOJA, q, situacao });
      assert.equal(w.tenantId, LOJA, `q=${q} situacao=${situacao}`);
      // Nada no OR pode relaxar o tenant: OR combina com AND implícito do topo.
      assert.equal("tenantId" in (w.OR?.[0] ?? {}), false);
    }
  }
});

test("número puro e #número procuram pelo número do pedido", () => {
  for (const q of ["47", "#47"]) {
    const w = filtroDePedidos({ tenantId: LOJA, q });
    assert.ok(w.OR?.some((c) => c.numero === 47), q);
  }
  // "47a" não é número de pedido, mas ainda procura por referência e nome.
  const w = filtroDePedidos({ tenantId: LOJA, q: "47a" });
  assert.equal(w.OR?.some((c) => "numero" in c), false);
  assert.ok(w.OR?.some((c) => c.clienteNome));
});

test("telefone só entra com quatro dígitos ou mais", () => {
  assert.equal(filtroDePedidos({ tenantId: LOJA, q: "12" }).OR?.some((c) => c.clienteTelefone), false);
  const w = filtroDePedidos({ tenantId: LOJA, q: "(16) 9931" });
  assert.deepEqual(w.OR?.find((c) => c.clienteTelefone), { clienteTelefone: { contains: "169931" } });
});

test("situação só filtra quando é uma situação real", () => {
  assert.equal(filtroDePedidos({ tenantId: LOJA, situacao: "PAGO" }).status, "PAGO");
  assert.equal(filtroDePedidos({ tenantId: LOJA, situacao: "'; drop" }).status, undefined);
  assert.equal(filtroDePedidos({ tenantId: LOJA, situacao: "" }).status, undefined);
});

test("página inválida vira 1, decimal vira inteiro", () => {
  assert.equal(paginaValida(null), 1);
  assert.equal(paginaValida("0"), 1);
  assert.equal(paginaValida("-3"), 1);
  assert.equal(paginaValida("abc"), 1);
  assert.equal(paginaValida("3.9"), 3);
  assert.equal(paginaValida("12"), 12);
});
