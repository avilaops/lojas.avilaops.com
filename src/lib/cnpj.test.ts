import assert from "node:assert/strict";
import test from "node:test";
import { normalizarDadosCnpj } from "./cnpj";

test("normaliza razão social e endereço retornados pela consulta de CNPJ", () => {
  assert.deepEqual(normalizarDadosCnpj({
    cnpj: "19.131.243/0001-97",
    razao_social: " OPEN KNOWLEDGE BRASIL ",
    nome_fantasia: "REDE PELO CONHECIMENTO LIVRE",
    email: "CONTATO@EXEMPLO.COM",
    ddd_telefone_1: "(11) 2385-1939",
    cep: "01311-902",
    descricao_tipo_de_logradouro: "AVENIDA",
    logradouro: "PAULISTA 37",
    numero: "37",
    complemento: "ANDAR 4",
    bairro: "BELA VISTA",
    municipio: "SAO PAULO",
    uf: "sp",
  }), {
    cnpj: "19131243000197",
    razaoSocial: "OPEN KNOWLEDGE BRASIL",
    nomeFantasia: "REDE PELO CONHECIMENTO LIVRE",
    email: "contato@exemplo.com",
    telefone: "1123851939",
    endereco: {
      cep: "01311902",
      logradouro: "AVENIDA PAULISTA 37",
      numero: "37",
      complemento: "ANDAR 4",
      bairro: "BELA VISTA",
      cidade: "SAO PAULO",
      uf: "SP",
    },
  });
});

test("campos ausentes viram texto vazio", () => {
  const dados = normalizarDadosCnpj({ cnpj: "19131243000197", razao_social: "Empresa" });
  assert.equal(dados.endereco.cep, "");
  assert.equal(dados.endereco.logradouro, "");
  assert.equal(dados.telefone, "");
});
