import assert from "node:assert/strict";
import test from "node:test";
import { calcularResumoAnalytics, resolverPeriodoAnalytics } from "./analytics-vendas";

test("periodo fica na timezone de Sao Paulo e compara janela de mesmo tamanho", () => {
  const p = resolverPeriodoAnalytics({ periodo: "7d" }, new Date("2026-09-12T15:00:00Z"));
  assert.equal(p.de.toISOString(), "2026-09-06T03:00:00.000Z");
  assert.equal(p.ate.toISOString(), "2026-09-13T02:59:59.999Z");
  assert.equal(p.anteriorAte.getTime() - p.anteriorDe.getTime(), p.ate.getTime() - p.de.getTime());
});

test("venda paga calcula centavos, clientes e comparacao sem floats financeiros", () => {
  const periodo = resolverPeriodoAnalytics({ periodo: "7d" }, new Date("2026-09-12T15:00:00Z"));
  const base = {
    descontoCentavos: 500,
    freteCentavos: 1000,
    clienteEmail: "cliente@exemplo.com",
    itens: [{ produtoId: "p1", nome: "Produto", quantidade: 2, precoUnitarioCentavos: 5000 }],
  };
  const resumo = calcularResumoAnalytics([
    { ...base, criadoEm: new Date("2026-09-10T12:00:00Z"), subtotalCentavos: 9500, totalCentavos: 10000 },
    { ...base, criadoEm: new Date("2026-09-03T12:00:00Z"), subtotalCentavos: 4500, totalCentavos: 5000 },
  ], periodo);
  assert.equal(resumo.receitaRecebidaCentavos, 10000);
  assert.equal(resumo.receitaBrutaCentavos, 10000);
  assert.equal(resumo.descontosCentavos, 500);
  assert.equal(resumo.pedidos, 1);
  assert.equal(resumo.clientesCompradores, 1);
  assert.equal(resumo.comparacao.receita, 100);
});
