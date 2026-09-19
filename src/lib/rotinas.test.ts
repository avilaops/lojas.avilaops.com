import assert from "node:assert/strict";
import { test } from "node:test";
import {
  ROTINAS,
  NOMES_DE_ROTINA,
  atrasada,
  descreverCadencia,
  diaDaSemanaLocal,
  ehNomeDeRotina,
  proximaExecucao,
} from "./rotinas";

// São Paulo é UTC-3 o ano todo desde 2019: 3h daqui é 06:00Z.
const utc = (texto: string) => new Date(texto);

test("intervalo conta do fim da execução anterior, não de um relógio fixo", () => {
  const fim = utc("2026-09-19T12:03:41.000Z");
  const proxima = proximaExecucao({ tipo: "intervalo", minutos: 5 }, fim);
  assert.equal(proxima.toISOString(), "2026-09-19T12:08:41.000Z");
});

test("rotina que demorou mais que a cadência não dispara duas vezes seguidas", () => {
  // Uma rodada de 5 min que levou 7: a próxima é 5 min depois do fim, não já.
  const fim = utc("2026-09-19T12:07:00.000Z");
  const proxima = proximaExecucao({ tipo: "intervalo", minutos: 5 }, fim);
  assert.ok(proxima.getTime() - fim.getTime() === 5 * 60_000);
});

test("diária às 3h é 06:00Z, e o dia vira quando já passou", () => {
  const cadencia = { tipo: "diaria", hora: 3 } as const;
  assert.equal(proximaExecucao(cadencia, utc("2026-09-19T01:00:00.000Z")).toISOString(), "2026-09-19T06:00:00.000Z");
  // 06:00Z é exatamente a hora: como é exclusivo, cai no dia seguinte.
  assert.equal(proximaExecucao(cadencia, utc("2026-09-19T06:00:00.000Z")).toISOString(), "2026-09-20T06:00:00.000Z");
  assert.equal(proximaExecucao(cadencia, utc("2026-09-19T10:00:00.000Z")).toISOString(), "2026-09-20T06:00:00.000Z");
});

test("a virada de mês e de ano não some com a rotina diária", () => {
  const cadencia = { tipo: "diaria", hora: 3 } as const;
  // 31/08 às 10h local (13:00Z) → 01/09 às 3h local.
  assert.equal(proximaExecucao(cadencia, utc("2026-08-31T13:00:00.000Z")).toISOString(), "2026-09-01T06:00:00.000Z");
  // 31/12/2026 às 21h local (2027-01-01T00:00Z) → 01/01/2027 às 3h local.
  assert.equal(proximaExecucao(cadencia, utc("2027-01-01T00:00:00.000Z")).toISOString(), "2027-01-01T06:00:00.000Z");
});

test("o 29 de fevereiro não é inventado nem pulado", () => {
  const cadencia = { tipo: "diaria", hora: 3 } as const;
  assert.equal(proximaExecucao(cadencia, utc("2028-02-28T13:00:00.000Z")).toISOString(), "2028-02-29T06:00:00.000Z");
  assert.equal(proximaExecucao(cadencia, utc("2027-02-28T13:00:00.000Z")).toISOString(), "2027-03-01T06:00:00.000Z");
});

test("semanal na segunda às 7h cai na próxima segunda, nunca antes", () => {
  const cadencia = { tipo: "semanal", diaDaSemana: 1, hora: 7 } as const;
  // sábado 19/09/2026 → segunda 21/09 às 7h local = 10:00Z.
  const proxima = proximaExecucao(cadencia, utc("2026-09-19T12:00:00.000Z"));
  assert.equal(proxima.toISOString(), "2026-09-21T10:00:00.000Z");
  assert.equal(diaDaSemanaLocal(proxima), 1);
  // Na própria segunda, depois da hora: pula a semana inteira.
  assert.equal(proximaExecucao(cadencia, proxima).toISOString(), "2026-09-28T10:00:00.000Z");
});

test("o dia da semana é o de São Paulo, não o do servidor", () => {
  // 21/09/2026 às 02:00Z ainda é domingo 23h em São Paulo.
  assert.equal(diaDaSemanaLocal(utc("2026-09-21T02:00:00.000Z")), 0);
  assert.equal(diaDaSemanaLocal(utc("2026-09-21T03:00:00.000Z")), 1);
});

test("toda rotina do catálogo tem cadência que anda para frente", () => {
  const agora = utc("2026-09-19T12:00:00.000Z");
  for (const nome of NOMES_DE_ROTINA) {
    const proxima = proximaExecucao(ROTINAS[nome].cadencia, agora);
    assert.ok(proxima.getTime() > agora.getTime(), `${nome} não avançou`);
    assert.ok(
      proxima.getTime() - agora.getTime() <= 8 * 24 * 60 * 60_000,
      `${nome} caiu longe demais`,
    );
  }
});

test("a cadência é lida em português, não em JSON", () => {
  assert.equal(descreverCadencia({ tipo: "intervalo", minutos: 5 }), "a cada 5 min");
  assert.equal(descreverCadencia({ tipo: "intervalo", minutos: 60 }), "a cada hora");
  assert.equal(descreverCadencia({ tipo: "intervalo", minutos: 180 }), "a cada 3 h");
  assert.equal(descreverCadencia({ tipo: "diaria", hora: 3 }), "todo dia às 03:00");
  assert.equal(descreverCadencia({ tipo: "semanal", diaDaSemana: 1, hora: 7 }), "toda segunda às 07:00");
});

test("atraso é medido contra a própria cadência", () => {
  const vencia = utc("2026-09-19T12:00:00.000Z");
  const cincoMin = { tipo: "intervalo", minutos: 5 } as const;
  // 9 min de atraso na fila do Mercado Livre ainda não é alarme; 11 é.
  assert.equal(atrasada(cincoMin, vencia, utc("2026-09-19T12:09:00.000Z")), false);
  assert.equal(atrasada(cincoMin, vencia, utc("2026-09-19T12:11:00.000Z")), true);
  // O mesmo atraso no relatório semanal não é nada.
  const semanal = { tipo: "semanal", diaDaSemana: 1, hora: 7 } as const;
  assert.equal(atrasada(semanal, vencia, utc("2026-09-19T13:00:00.000Z")), false);
  assert.equal(atrasada(semanal, vencia, utc("2026-09-19T15:00:00.000Z")), true);
});

test("nome de rotina vindo da URL é conferido contra o catálogo", () => {
  assert.equal(ehNomeDeRotina("mercadolivre.avisos"), true);
  assert.equal(ehNomeDeRotina("constructor"), false);
  assert.equal(ehNomeDeRotina("../../etc"), false);
});

test("a fila do Mercado Livre é a mais frequente do catálogo", () => {
  // Documenta a decisão: espaçar esta rotina reabre a janela de vender a
  // mesma peça duas vezes. Se alguém aumentar o intervalo, o teste cai.
  const ml = ROTINAS["mercadolivre.avisos"].cadencia;
  assert.equal(ml.tipo, "intervalo");
  assert.ok(ml.tipo === "intervalo" && ml.minutos <= 5);
});
