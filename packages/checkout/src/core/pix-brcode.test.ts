import assert from "node:assert/strict";
import test from "node:test";
import { crc16Pix, montarBrCodePix, txidDaReferencia, valorComCentavosUnicos, valorPixEmReais } from "./pix-brcode.ts";

/**
 * Exemplo estático do Manual de Padrões para Iniciação do Pix, sem valor.
 * O CRC `1D3D` é o do manual, não um valor calculado por este arquivo e
 * colado de volta.
 */
const EXEMPLO_DO_MANUAL =
  "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865802BR5913Fulano de Tal6008BRASILIA62070503***63041D3D";

test("CRC16 do exemplo do Banco Central é 1D3D", () => {
  const semCrc = EXEMPLO_DO_MANUAL.slice(0, -4);
  assert.equal(semCrc.endsWith("6304"), true);
  assert.equal(crc16Pix(semCrc), "1D3D");
});

test("BR Code estático sem valor reproduz o exemplo do manual", () => {
  const payload = montarBrCodePix({
    chave: "123e4567-e12b-12d1-a456-426655440000",
    nome: "Fulano de Tal",
    cidade: "BRASILIA",
    txid: "***",
  });
  assert.equal(payload, EXEMPLO_DO_MANUAL);
});

test("BR Code com valor e txid carrega os dois e fecha o CRC", () => {
  // Mesmo recebedor do manual, com R$ 10,00 no campo 54 e txid PEDIDO123.
  const payload = montarBrCodePix({
    chave: "123e4567-e12b-12d1-a456-426655440000",
    nome: "Fulano de Tal",
    cidade: "BRASILIA",
    valorCentavos: 1000,
    txid: "PEDIDO123",
  });
  assert.equal(
    payload,
    "00020126580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-426655440000520400005303986540510.005802BR5913Fulano de Tal6008BRASILIA62130509PEDIDO1236304902A",
  );
  assert.equal(crc16Pix(payload.slice(0, -4)), "902A");
  assert.equal(payload.includes("540510.00"), true);
  assert.equal(payload.includes("0509PEDIDO123"), true);
  // Um bit errado no meio não pode continuar com o mesmo CRC.
  const adulterado = `${payload.slice(0, -8)}9${payload.slice(-7, -4)}`;
  assert.notEqual(crc16Pix(adulterado.slice(0, -4)), adulterado.slice(-4));
});

test("valor em reais usa ponto e duas casas, sem float", () => {
  assert.equal(valorPixEmReais(1), "0.01");
  assert.equal(valorPixEmReais(1000), "10.00");
  assert.equal(valorPixEmReais(1099), "10.99");
  assert.throws(() => valorPixEmReais(0), /inválido/);
  assert.throws(() => valorPixEmReais(10.5), /inválido/);
});

test("txid é a referência quando cabe, e os últimos 25 alfanuméricos quando não", () => {
  assert.equal(txidDaReferencia("PEDIDO1234567890AB"), "PEDIDO1234567890AB");
  assert.equal(txidDaReferencia("qa-pedido-123"), "qapedido123");
  const longa = `LOJA-${"A".repeat(40)}`;
  assert.equal(txidDaReferencia(longa), "A".repeat(25));
  assert.throws(() => txidDaReferencia("---"), /identificador/);
});

test("centavos únicos sobem de um em um e param em 99", () => {
  assert.equal(valorComCentavosUnicos(1000, []), 1000);
  assert.equal(valorComCentavosUnicos(1000, [1000]), 1001);
  assert.equal(valorComCentavosUnicos(1000, [1000, 1002]), 1001);
  const ocupados = Array.from({ length: 100 }, (_, i) => 5000 + i);
  assert.throws(() => valorComCentavosUnicos(5000, ocupados), /centavo livre/);
});
