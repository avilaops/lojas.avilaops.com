import assert from "node:assert/strict";
import test from "node:test";
import { localPublicoDeRetirada } from "./retirada-publica";

const loja = {
  nome: "Loja QA", razaoSocial: null, cnpj: null, whatsapp: null, telefone: null, emailContato: null,
  horario: "Segunda a sexta, das 9h às 18h", retiradaNaLoja: true, enderecoPublico: true,
  endereco: { logradouro: "Rua QA", numero: "100", bairro: "Centro", cidade: "Ribeirão Preto", uf: "SP", cep: "14010000" },
};

test("retirada divulga apenas destino público completo e horário cadastrado", () => {
  assert.deepEqual(localPublicoDeRetirada(loja), {
    endereco: "Rua QA, 100 · Centro · Ribeirão Preto - SP · 14010-000",
    horario: loja.horario,
  });
  assert.equal(localPublicoDeRetirada({ ...loja, horario: null })?.horario, null);
});

test("retirada desligada, endereço privado ou inválido não expõem o local", () => {
  assert.equal(localPublicoDeRetirada({ ...loja, enderecoPublico: false }), null);
  assert.equal(localPublicoDeRetirada({ ...loja, retiradaNaLoja: false }), null);
  assert.equal(localPublicoDeRetirada({ ...loja, endereco: { ...loja.endereco, bairro: "" } }), null);
  assert.equal(localPublicoDeRetirada({ ...loja, endereco: { ...loja.endereco, cep: "00000000" } }), null);
});
