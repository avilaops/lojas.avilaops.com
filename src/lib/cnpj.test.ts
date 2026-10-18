import assert from "node:assert/strict";
import test from "node:test";
import { normalizarDadosCnpj, normalizarDadosCnpjWs } from "./cnpj";

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

test("normaliza a fonte de contingência CNPJ.ws", () => {
  assert.deepEqual(normalizarDadosCnpjWs({
    razao_social: "BRILHAX PRODUTOS PARA ESTETICA AUTOMOTIVA LTDA",
    estabelecimento: {
      cnpj: "67554083000131",
      nome_fantasia: null,
      email: "CONTATO@BRILHAX.COM",
      ddd1: "16",
      telefone1: "97876884",
      cep: "14075240",
      tipo_logradouro: "RUA",
      logradouro: "HOLANDA",
      numero: "1200",
      complemento: null,
      bairro: "VILA MARIANA",
      cidade: { nome: "Ribeirão Preto" },
      estado: { sigla: "SP" },
    },
  }), {
    cnpj: "67554083000131",
    razaoSocial: "BRILHAX PRODUTOS PARA ESTETICA AUTOMOTIVA LTDA",
    nomeFantasia: "",
    email: "contato@brilhax.com",
    telefone: "1697876884",
    endereco: {
      cep: "14075240",
      logradouro: "RUA HOLANDA",
      numero: "1200",
      complemento: "",
      bairro: "VILA MARIANA",
      cidade: "Ribeirão Preto",
      uf: "SP",
    },
  });
});
