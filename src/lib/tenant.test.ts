import assert from "node:assert/strict";
import test from "node:test";
import type { Tenant } from "@prisma/client";
import { contatoConfigurado, enderecoCompleto, formatarCep, lojaVende, porOndeFalarCom, prazoDeDespacho } from "./tenant";

/**
 * `lojaVende` decide se a loja mostra "Finalizar compra" ou "Pedir pelo
 * WhatsApp". Errar para mais é o pior dos dois: o comprador percorre o
 * checkout inteiro e descobre no fim que não dá para pagar.
 */
function loja(parcial: Partial<Tenant>): Tenant {
  return { status: "ATIVA", plano: "LOJA", mpAccessTokenEnc: "v1.x.y.z", ...parcial } as Tenant;
}

test("loja ativa, com plano de venda e credencial, vende", () => {
  assert.equal(lojaVende(loja({})), true);
});

test("sem credencial de pagamento não vende, mesmo ativa", () => {
  // É o caso das lojas-demo: vitrine completa, pedido pelo WhatsApp.
  assert.equal(lojaVende(loja({ mpAccessTokenEnc: null })), false);
});

test("plano Site nunca vende, mesmo com credencial", () => {
  assert.equal(lojaVende(loja({ plano: "SITE" })), false);
});

test("loja suspensa não vende: a vitrine fica, o checkout some", () => {
  assert.equal(lojaVende(loja({ status: "SUSPENSA" })), false);
});

test("loja em provisionamento ou cancelada não vende", () => {
  assert.equal(lojaVende(loja({ status: "PROVISIONANDO" })), false);
  assert.equal(lojaVende(loja({ status: "CANCELADA" })), false);
});

/**
 * O CEP entra só com dígitos (o schema limpa) e sai formatado na vitrine: o
 * rodapé da loja recém-criada mostrava "01001000".
 */
test("CEP de 8 dígitos sai formatado", () => {
  assert.equal(formatarCep("01001000"), "01001-000");
  assert.equal(formatarCep("01001-000"), "01001-000");
});

test("CEP incompleto ou ausente sai como veio, sem inventar hífen", () => {
  assert.equal(formatarCep("0100"), "0100");
  assert.equal(formatarCep(undefined), "");
});

test("endereço completo da loja usa o CEP formatado", () => {
  const t = loja({ endereco: { logradouro: "Rua das Oficinas", numero: "120", bairro: "Centro", cidade: "São Paulo", uf: "SP", cep: "01001000" } });
  assert.equal(enderecoCompleto(t), "Rua das Oficinas, 120 · Centro · São Paulo - SP · 01001-000");
});

/**
 * As três frases que a loja escreve sobre si mesma. Todas saíram erradas na
 * Vedashow ao mesmo tempo, e nenhuma por falta de dado: por concatenação.
 */

test("prazo de despacho concorda com o número, e zero é mesmo dia", () => {
  // Era `${dias} dia(s) útil(eis)` em três telas — texto de template chegando
  // ao comprador justamente na frase que promete um prazo.
  assert.equal(prazoDeDespacho(0), "no mesmo dia útil");
  assert.equal(prazoDeDespacho(1), "em até 1 dia útil");
  assert.equal(prazoDeDespacho(3), "em até 3 dias úteis");
});

test("a preposição vem junto do canal, porque concorda com ele", () => {
  // `pelo ${contato}` fixo escrevia "fale conosco pelo nossos canais de
  // atendimento" nas três políticas — erro de concordância em página jurídica.
  assert.equal(porOndeFalarCom(loja({ emailContato: "oi@loja.com.br" })), "pelo oi@loja.com.br");
  assert.equal(porOndeFalarCom(loja({ whatsapp: "16999999999" })), "pelo WhatsApp da loja");
  assert.equal(porOndeFalarCom(loja({})), "pelos nossos canais de atendimento");
});

test("loja sem canal nenhum é loja sem contato, e a página precisa saber", () => {
  // Com todos os campos vazios, /contato servia um <h1> e uma lista sem itens.
  assert.equal(contatoConfigurado(loja({})), false);
  assert.equal(contatoConfigurado(loja({ telefone: "1633334444" })), true);
  assert.equal(contatoConfigurado(loja({ enderecoPublico: true })), true);
});
