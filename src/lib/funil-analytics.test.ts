import assert from "node:assert/strict";
import test from "node:test";
import { calcularFunil, camposDaSessaoParaEvento, recorrenciaNoPeriodo, taxa } from "./funil-analytics";

test("cada evento público altera somente o marco agregado correspondente", () => {
  assert.deepEqual(camposDaSessaoParaEvento("search"), { buscou: true });
  assert.deepEqual(camposDaSessaoParaEvento("search_no_results"), { buscou: true, buscaSemResultado: true });
  assert.deepEqual(camposDaSessaoParaEvento("filter_apply"), { filtrou: true });
  assert.deepEqual(camposDaSessaoParaEvento("view_item"), { viuProduto: true });
  assert.deepEqual(camposDaSessaoParaEvento("technical_contact"), { contatoTecnico: true });
  assert.deepEqual(camposDaSessaoParaEvento("add_to_cart"), { adicionouCarrinho: true });
  assert.deepEqual(camposDaSessaoParaEvento("view_cart"), { abriuCarrinho: true });
  assert.deepEqual(camposDaSessaoParaEvento("begin_checkout"), { iniciouCheckout: true });
});

test("taxa sem denominador é indisponível e não zero inventado", () => {
  assert.equal(taxa(0, 0), null);
  assert.equal(taxa(1, 4), 25);
  assert.equal(taxa(2, 3), 66.7);
});

test("recompra reconhece compra anterior e segunda compra dentro do período", () => {
  const inicio = new Date("2026-10-01T00:00:00Z");
  const { compradores, recorrentes } = recorrenciaNoPeriodo([
    { clienteEmail: " Ana@Example.com ", criadoEm: new Date("2026-09-01T12:00:00Z") },
    { clienteEmail: "ana@example.com", criadoEm: new Date("2026-10-05T12:00:00Z") },
    { clienteEmail: "bia@example.com", criadoEm: new Date("2026-10-06T12:00:00Z") },
    { clienteEmail: "bia@example.com", criadoEm: new Date("2026-10-07T12:00:00Z") },
    { clienteEmail: "caio@example.com", criadoEm: new Date("2026-10-08T12:00:00Z") },
  ], inicio);
  assert.deepEqual([...compradores].sort(), ["ana@example.com", "bia@example.com", "caio@example.com"]);
  assert.deepEqual([...recorrentes].sort(), ["ana@example.com", "bia@example.com"]);
});

test("funil usa sessões únicas e pedido pago vinculado", () => {
  const sessoes = [
    { id: "s1", buscou: true, buscaSemResultado: false, filtrou: true, viuProduto: true, contatoTecnico: false, adicionouCarrinho: true, abriuCarrinho: true, iniciouCheckout: true, pedidos: [{ clienteEmail: "ana@example.com", status: "PAGO" }] },
    { id: "s2", buscou: true, buscaSemResultado: true, filtrou: false, viuProduto: false, contatoTecnico: true, adicionouCarrinho: false, abriuCarrinho: false, iniciouCheckout: false, pedidos: [] },
    { id: "s3", buscou: false, buscaSemResultado: false, filtrou: false, viuProduto: true, contatoTecnico: true, adicionouCarrinho: true, abriuCarrinho: true, iniciouCheckout: false, pedidos: [] },
  ];
  const resumo = calcularFunil(sessoes, new Set(["ana@example.com"]), new Set(["ana@example.com", "bia@example.com"]));
  assert.deepEqual(resumo.contagens, {
    sessoes: 3, buscas: 2, buscasSemResultado: 1, filtros: 1, produtos: 2,
    contatosTecnicos: 2, carrinhosAdicionados: 2, carrinhosAbertos: 2,
    checkouts: 1, pedidosCriados: 1, pagamentosAprovados: 1, compras: 1, clientesCompradores: 2, clientesRecorrentes: 1,
  });
  assert.equal(resumo.taxas.buscaSemResultado, 50);
  assert.equal(resumo.taxas.produto, 66.7);
  assert.equal(resumo.taxas.carrinho, 100);
  assert.equal(resumo.taxas.checkout, 50);
  assert.equal(resumo.taxas.compra, 33.3);
  assert.equal(resumo.taxas.pagamento, 100);
  assert.equal(resumo.taxas.contatoTecnico, 100);
  assert.equal(resumo.taxas.recompra, 50);
});

