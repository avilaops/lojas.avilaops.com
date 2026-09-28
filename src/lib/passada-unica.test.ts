import assert from "node:assert/strict";
import { test } from "node:test";
import { passadaUnica, type EstadoDaPassada } from "./passada-unica";

const nunca = () => new Promise<void>(() => {});
const jaFoi = () => Promise.resolve();

test("passada que termina solta a guarda e não é dada por perdida", async () => {
  const estado: EstadoDaPassada = {};
  const relato = await passadaUnica(estado, 60_000, jaFoi);
  assert.deepEqual(relato, { pulada: false, perdida: false });
  assert.equal(estado.emAndamento, false);
});

test("passada nova é pulada enquanto a anterior corre", async () => {
  const estado: EstadoDaPassada = {};
  let soltar = () => {};
  const primeira = passadaUnica(estado, 60_000, () => new Promise<void>((r) => (soltar = r)));

  const segunda = await passadaUnica(estado, 60_000, () => {
    assert.fail("a segunda passada não devia ter começado");
  });
  assert.deepEqual(segunda, { pulada: true, perdida: false });

  soltar();
  assert.deepEqual(await primeira, { pulada: false, perdida: false });
});

test("passada que não volta é dada por perdida no prazo, em vez de esperar para sempre", async () => {
  const estado: EstadoDaPassada = {};
  const relato = await passadaUnica(estado, 20, nunca);
  assert.deepEqual(relato, { pulada: false, perdida: true });
});

test("e o próximo tique anda: guarda solta depois do prazo", async () => {
  const estado: EstadoDaPassada = {};
  await passadaUnica(estado, 20, nunca);
  assert.equal(estado.emAndamento, false);

  let rodou = false;
  const seguinte = await passadaUnica(estado, 60_000, async () => {
    rodou = true;
  });
  assert.equal(rodou, true, "a passada seguinte precisa rodar; o relógio não pode ficar travado");
  assert.deepEqual(seguinte, { pulada: false, perdida: false });
});

test("passada pendurada que falha mais tarde não derruba o processo", async () => {
  const estado: EstadoDaPassada = {};
  let quebrar: (erro: Error) => void = () => {};
  const relato = await passadaUnica(estado, 20, () => new Promise<void>((_, rejeitar) => (quebrar = rejeitar)));
  assert.equal(relato.perdida, true);

  // A rejeição chega quando a corrida já foi embora. Sem dono, isto seria uma
  // unhandledRejection — e em Node moderno unhandledRejection encerra o
  // processo, ou seja: a loja inteira sai do ar por causa de uma rotina.
  quebrar(new Error("o banco caiu no meio"));
  await new Promise((r) => setTimeout(r, 10));

  // E a guarda continua solta: a queda tardia não pode travar o relógio.
  assert.equal(estado.emAndamento, false);
});

test("erro da passada continua chegando a quem chamou, quando chega a tempo", async () => {
  const estado: EstadoDaPassada = {};
  await assert.rejects(
    () => passadaUnica(estado, 60_000, async () => { throw new Error("falhou de verdade"); }),
    /falhou de verdade/,
  );
  assert.equal(estado.emAndamento, false, "erro também solta a guarda");
});
