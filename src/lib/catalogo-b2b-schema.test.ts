import assert from "node:assert/strict";
import { test } from "node:test";
import { EntradaCatalogoB2BSchema } from "./catalogo-b2b-schema";

const base = {
  referencia: "tabela-industria",
  nome: "Tabela indústria",
  versao: 1,
  moeda: "BRL",
  vigenteDesde: "2026-10-18T00:00:00.000Z",
  vigenteAte: null,
  atribuicoes: [{ empresaReferencia: "cliente-a", unidadeReferencia: null, prioridade: 0 }],
  itens: [{
    produtoReferencia: "SKU-1",
    varianteReferencia: null,
    acao: "INCLUIR",
    estrategiaPreco: "FIXO",
    precoFixoCentavos: 900,
    quantidadeMinima: 1,
    quantidadeMaxima: null,
    multiploVenda: 1,
    quantidadePorEmbalagem: 1,
    unidadeComercial: "UN",
    unidadesBaseNumerador: 1,
    unidadesBaseDenominador: 1,
    componentes: [],
  }],
};

test("aceita preço fixo e desconto exclusivamente em BRL", () => {
  assert.equal(EntradaCatalogoB2BSchema.parse(base).moeda, "BRL");
  assert.equal(EntradaCatalogoB2BSchema.parse({ ...base, itens: [{ ...base.itens[0], estrategiaPreco: "DESCONTO", precoFixoCentavos: undefined, descontoPontosBase: 1250 }] }).itens[0].estrategiaPreco, "DESCONTO");
  assert.throws(() => EntradaCatalogoB2BSchema.parse({ ...base, moeda: "USD" }), /BRL/);
  assert.throws(() => EntradaCatalogoB2BSchema.parse({ ...base, itens: [{ ...base.itens[0], descontoPontosBase: 100 }] }), /preço|estratégia/i);
});

test("recusa intervalo, múltiplo e razões inválidos com mensagens estáveis", () => {
  assert.throws(() => EntradaCatalogoB2BSchema.parse({ ...base, vigenteAte: "2026-10-17T00:00:00.000Z" }), /posterior/);
  assert.throws(() => EntradaCatalogoB2BSchema.parse({ ...base, itens: [{ ...base.itens[0], quantidadeMinima: 10, quantidadeMaxima: 9 }] }), /máxima/);
  assert.throws(() => EntradaCatalogoB2BSchema.parse({ ...base, itens: [{ ...base.itens[0], multiploVenda: 0 }] }), /múltiplo/);
  assert.throws(() => EntradaCatalogoB2BSchema.parse({ ...base, itens: [{ ...base.itens[0], unidadesBaseDenominador: 0 }] }), /razão/);
  assert.throws(() => EntradaCatalogoB2BSchema.parse({ ...base, itens: [{ ...base.itens[0], componentes: [{ varianteReferencia: "KIT-1", quantidadeBaseNumerador: 1, quantidadeBaseDenominador: 0 }] }] }), /razão/);
});

test("exclusão não aceita estratégia nem preço", () => {
  const item = { ...base.itens[0], acao: "EXCLUIR", estrategiaPreco: undefined, precoFixoCentavos: undefined };
  assert.equal(EntradaCatalogoB2BSchema.parse({ ...base, itens: [item] }).itens[0].acao, "EXCLUIR");
  assert.throws(() => EntradaCatalogoB2BSchema.parse({ ...base, itens: [{ ...item, precoFixoCentavos: 1 }] }), /exclusão/i);
});
