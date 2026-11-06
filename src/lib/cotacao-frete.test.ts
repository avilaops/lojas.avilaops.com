import assert from "node:assert/strict";
import test from "node:test";
import { consultarFrete } from "./cotacao-frete";

const entrada = { cep: "14075-240", itens: [{ id: "produto:variante", quantidade: 2 }], cupom: "ENTREGA" };

test("cotação usa CEP normalizado, variantes, quantidades e cupom sem dados pessoais", async () => {
  const controle = new AbortController();
  const opcoes = [{ id: "local:0", nome: "Entrega local", preco: 1500, prazoDiasUteis: 1 }];
  const enviar: typeof fetch = async (url, init) => {
    assert.equal(url, "/api/frete");
    assert.equal(init?.signal, controle.signal);
    assert.deepEqual(JSON.parse(String(init?.body)), { ...entrada, cep: "14075240" });
    return Response.json(opcoes);
  };
  assert.deepEqual(await consultarFrete(entrada, controle.signal, enviar), opcoes);
});

test("CEP incompleto não dispara uma consulta", async () => {
  await assert.rejects(() => consultarFrete({ ...entrada, cep: "140" }, undefined, async () => { throw Error("não deveria enviar"); }), /8 dígitos/);
});

test("falha HTTP, formato inválido e valores inválidos nunca viram frete grátis", async () => {
  for (const resposta of [
    Response.json({ erro: "indisponível" }, { status: 503 }),
    new Response("não é JSON"),
    Response.json({ erro: "indisponível" }),
    Response.json([{ id: "pac", nome: "PAC", prazoDiasUteis: 3 }]),
    Response.json([{ id: "pac", nome: "PAC", preco: -1, prazoDiasUteis: 3 }]),
    Response.json([{ id: "pac", nome: "PAC", preco: 12.5, prazoDiasUteis: 3 }]),
  ]) await assert.rejects(() => consultarFrete(entrada, undefined, async () => resposta));
});

test("lista vazia é ausência de opções e retirada é preservada como opção própria", async () => {
  assert.deepEqual(await consultarFrete(entrada, undefined, async () => Response.json([])), []);
  const retirada = [{ id: "retirada-na-loja", nome: "Retirar na loja", preco: 0, prazoDiasUteis: 1 }];
  assert.deepEqual(await consultarFrete(entrada, undefined, async () => Response.json(retirada)), retirada);
});
