import assert from "node:assert/strict";
import test from "node:test";
import { LIMITES, lerReputacao } from "./mercadolivre-reputacao";

/**
 * A reputação é calculada pelo Mercado Livre; o que está preso aqui é a
 * tradução dela em frase acionável — e, principalmente, o silêncio quando não
 * há o que dizer. Alerta inventado em conta nova é pior que alerta nenhum.
 */

test("taxa do ML (0 a 1) vira porcentagem com uma casa", () => {
  const r = lerReputacao({ seller_reputation: { metrics: { claims: { rate: 0.0123 }, delayed_handling_time: { rate: 0.2 }, cancellations: { rate: 0 } } } });
  assert.equal(r.reclamacoes, 1.2);
  assert.equal(r.atrasos, 20);
  assert.equal(r.cancelamentos, 0);
});

test("conta nova não recebe alerta nenhum", () => {
  const r = lerReputacao({ seller_reputation: { level_id: "newbie", transactions: { total: 0, completed: 0, canceled: 0 } } });
  assert.deepEqual(r.alertas, []);
  assert.equal(r.nivel, "newbie");
});

test("métrica acima do limite vira frase com o número e o caminho", () => {
  const r = lerReputacao({
    seller_reputation: {
      power_seller_status: "gold",
      metrics: { claims: { rate: 0.031 }, delayed_handling_time: { rate: 0.18 }, cancellations: { rate: 0.025 } },
      transactions: { total: 100, completed: 95, canceled: 5 },
    },
  });
  assert.equal(r.alertas.length, 3);
  assert.match(r.alertas[0], /3\.1%.*2%/);
  assert.match(r.alertas[1], /18%.*15%/);
  assert.match(r.alertas[2], /2\.5%.*sincronização de estoque/);
});

test("métrica dentro do limite não vira alerta", () => {
  const r = lerReputacao({
    seller_reputation: {
      power_seller_status: "platinum",
      metrics: { claims: { rate: LIMITES.reclamacoes / 100 }, delayed_handling_time: { rate: LIMITES.atrasos / 100 }, cancellations: { rate: 0 } },
      transactions: { total: 500, completed: 498, canceled: 2 },
    },
  });
  assert.deepEqual(r.alertas, [], "o limite é o teto aceito, não o começo do problema");
});

test("quem já vendeu e não tem selo ouve isso uma vez, sem promessa de atalho", () => {
  const r = lerReputacao({ seller_reputation: { transactions: { total: 40, completed: 40, canceled: 0 } } });
  assert.equal(r.alertas.length, 1);
  assert.match(r.alertas[0], /Mercado Líder/);
  assert.equal(r.selo, null);
});

test("resposta vazia do ML não quebra nem inventa número", () => {
  const r = lerReputacao({});
  assert.deepEqual(r, { nivel: null, selo: null, transacoes: 0, concluidas: 0, canceladas: 0, reclamacoes: null, atrasos: null, cancelamentos: null, positivas: null, neutras: null, negativas: null, alertas: [] });
});
