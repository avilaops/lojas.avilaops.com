import assert from "node:assert/strict";
import test from "node:test";

const modulo = await import("../../src/lib/catalogo-oferta.ts");
const { ofertaDaVariante } = modulo.default ?? modulo;
const instante = new Date("2026-11-12T12:00:00Z");

function variante(saldos) {
  return {
    id: "variante-1", tenantId: "loja-1", produtoId: "produto-1", padrao: true,
    valores: {}, nome: "Única", sku: "SKU-1", gtin: null, mpn: null,
    identificadoresEstado: "desconhecido", disponibilidade: "in_stock",
    precoCentavos: 1000, estoque: null, pesoKg: null, alturaCm: null,
    larguraCm: null, comprimentoCm: null, imagem: null, ativo: true, ordem: 0,
    preco: { varianteId: "variante-1", tenantId: "loja-1", moeda: "BRL",
      valorCentavos: 1000, comparacaoCentavos: null, atualizadoEm: instante },
    saldos: saldos.map(([local, fisico, reservado = 0]) => ({
      id: `saldo-${local}`, tenantId: "loja-1", varianteId: "variante-1",
      local, fisico, reservado, atualizadoEm: instante,
    })),
  };
}

for (const caso of [
  { nome: "oferta não soma unidades da filial às unidades reserváveis no principal",
    saldos: [["principal", 5, 2], ["filial", 100]], estoque: 3, compravel: true },
  { nome: "filial com estoque não torna comprável um principal zerado",
    saldos: [["principal", 0], ["filial", 5]], estoque: 0, compravel: false },
  { nome: "saldo remoto não controlado não libera unidades reservadas do principal",
    saldos: [["principal", 1, 1], ["filial", null]], estoque: 0, compravel: false },
  { nome: "saldo apenas na filial não substitui o local de reserva do checkout",
    saldos: [["filial", 5]], estoque: 0, compravel: false },
  { nome: "saldo remoto nulo não implica principal com disponibilidade ilimitada",
    saldos: [["filial", null]], estoque: 0, compravel: false },
  { nome: "principal não controlado preserva a venda sem limite de saldo",
    saldos: [["principal", null], ["filial", 0]], estoque: null, compravel: true },
  { nome: "variante sem saldo cadastrado permanece indisponível",
    saldos: [], estoque: 0, compravel: false },
]) {
  test(caso.nome, () => {
    const oferta = ofertaDaVariante(variante(caso.saldos));
    assert.equal(oferta.estoque, caso.estoque);
    assert.equal(oferta.compravel, caso.compravel);
  });
}
