import assert from "node:assert/strict";
import test from "node:test";
import { cotarMelhorEnvio, extrairCotacoes } from "./melhor-envio";

/**
 * A chamada ao Melhor Envio é integração e fica de fora; o que dá para travar
 * sem rede é a leitura da resposta, que é onde o preço do checkout nasce.
 *
 * O formato abaixo é o de `POST /api/v2/me/shipment/calculate`: uma lista com
 * um item por serviço, preço em texto com ponto, e erro no próprio item.
 */

const RESPOSTA = [
  { id: 2, name: "SEDEX", price: "32.10", custom_price: "32.10", delivery_time: 2, custom_delivery_time: 2, company: { id: 1, name: "Correios" } },
  { id: 1, name: "PAC", price: "21.40", custom_price: "23.72", delivery_time: 6, custom_delivery_time: 8, company: { id: 1, name: "Correios" } },
  { id: 3, name: ".Package", price: "18.95", custom_price: "18.95", delivery_time: 5, custom_delivery_time: 5, company: { id: 2, name: "Jadlog" } },
  { id: 4, name: ".Com", error: "Transportadora não atende este trecho.", company: { id: 2, name: "Jadlog" } },
];

test("lê preço em centavos, ordena pelo mais barato e identifica o serviço", () => {
  assert.deepEqual(extrairCotacoes(RESPOSTA), [
    { id: "melhorenvio:3", nome: "Jadlog .Package", preco: 1895, prazoDiasUteis: 5 },
    { id: "melhorenvio:1", nome: "PAC", preco: 2372, prazoDiasUteis: 8 },
    { id: "melhorenvio:2", nome: "SEDEX", preco: 3210, prazoDiasUteis: 2 },
  ]);
});

test("serviço que não atende o trecho não vira opção de R$ 0", () => {
  // O item com `error` não traz preço: sem o filtro ele entraria como frete
  // grátis e seria justamente o primeiro da lista.
  assert.equal(extrairCotacoes(RESPOSTA).some((o) => o.id === "melhorenvio:4"), false);
});

test("o preço configurado na conta vence o preço cru do serviço", () => {
  const [pac] = extrairCotacoes([RESPOSTA[1]]);
  assert.equal(pac.preco, 2372, "custom_price, não price");
  assert.equal(pac.prazoDiasUteis, 8, "custom_delivery_time, não delivery_time");
});

test("nome do serviço não repete a transportadora que já está nele", () => {
  const [loggi] = extrairCotacoes([{ id: 31, name: "Loggi Express", price: "15.00", delivery_time: 3, company: { name: "Loggi" } }]);
  assert.equal(loggi.nome, "Loggi Express");
});

test("item sem prazo assume uma semana, e item sem preço some", () => {
  assert.deepEqual(extrairCotacoes([
    { id: 1, name: "PAC", price: "20.00", company: { name: "Correios" } },
    { id: 2, name: "SEDEX", price: "0.00", delivery_time: 2, company: { name: "Correios" } },
    { id: 17, name: "Mini Envios", delivery_time: 7, company: { name: "Correios" } },
  ]), [{ id: "melhorenvio:1", nome: "PAC", preco: 2000, prazoDiasUteis: 7 }]);
});

test("resposta que não é lista não derruba a cotação", () => {
  // Token inválido devolve um objeto `{ message: "Unauthenticated." }`.
  assert.deepEqual(extrairCotacoes({ message: "Unauthenticated." }), []);
  assert.deepEqual(extrairCotacoes(null), []);
});

test("sem token não cota e não chama a rede", async () => {
  const fetchAntes = globalThis.fetch;
  let chamou = false;
  globalThis.fetch = (async () => { chamou = true; return Response.json([]); }) as typeof fetch;
  try {
    assert.equal(
      await cotarMelhorEnvio("", { cepOrigem: "14010100", cepDestino: "15075170", pesoKg: 0.5, caixa: { altura: 15, largura: 20, comprimento: 25 }, valorDeclarado: 80 }),
      null,
    );
    assert.equal(chamou, false);
  } finally {
    globalThis.fetch = fetchAntes;
  }
});
