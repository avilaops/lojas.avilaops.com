import assert from "node:assert/strict";
import test from "node:test";
import type { DefinicaoProvedor } from "@avilaops/checkout/server";
import { provedoresVisiveis, provedorVisivel, separarValores } from "./recebimento-v2";

const pixDireto: DefinicaoProvedor = {
  id: "pix_manual",
  nome: "Pix direto",
  capacidades: { pix: true, cartao: false, boleto: false, estorno: false, estornoParcial: false, webhook: false, confirmacaoAutomatica: false },
  tipoConexao: "pix_direto",
  campos: [
    { chave: "chavePix", rotulo: "Chave Pix", segredo: false, obrigatorio: true },
    { chave: "nomeRecebedor", rotulo: "Nome do recebedor", segredo: false, obrigatorio: true },
    { chave: "token", rotulo: "Token", segredo: true, obrigatorio: false },
  ],
  guia: [],
  criar: () => { throw new Error("não usado"); },
  testarConexao: async () => ({ ok: true, mensagem: "ok", avisos: [] }),
};

test("Mercado Pago aparece sempre; provedor não registrado não aparece nem com a flag", () => {
  assert.deepEqual(provedoresVisiveis({ recursos: [] }).map((d) => d.id), ["mercadopago"]);
  assert.deepEqual(provedoresVisiveis({ recursos: ["pagamentos_pagbank"] }).map((d) => d.id), ["mercadopago"]);
  assert.equal(provedorVisivel({ recursos: [] }, "pagbank"), null);
});

test("separa segredos de públicos, descarta campo estranho e explica o obrigatório vazio", () => {
  const r = separarValores(pixDireto, { chavePix: " loja@exemplo.com ", nomeRecebedor: "Loja QA", token: "s3gr3do", intruso: "x" });
  assert.ok(r.ok);
  assert.deepEqual(r.publicos, { chavePix: "loja@exemplo.com", nomeRecebedor: "Loja QA" });
  assert.deepEqual(r.segredos, { token: "s3gr3do" });
  const faltando = separarValores(pixDireto, { chavePix: "x" });
  assert.deepEqual(faltando, { ok: false, mensagem: "Preencha “Nome do recebedor”." });
  assert.equal(separarValores(pixDireto, null).ok, false);
});
