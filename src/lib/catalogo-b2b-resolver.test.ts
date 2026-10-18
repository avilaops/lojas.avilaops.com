import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { resolverOfertaB2B, type AtribuicaoResolucaoB2B } from "./catalogo-b2b-resolver";

const agora = new Date("2026-10-18T15:00:00.000Z");

function atribuicao(parcial: Partial<AtribuicaoResolucaoB2B> = {}): AtribuicaoResolucaoB2B {
  return {
    id: "atr-base",
    catalogoVersaoId: "versao-base",
    empresaId: "empresa-1",
    unidadeId: null,
    prioridade: 0,
    versao: 1,
    vigenteDesde: new Date("2026-10-01T00:00:00.000Z"),
    vigenteAte: null,
    itens: [{
      id: "item-base",
      produtoId: "produto-1",
      varianteId: null,
      acao: "INCLUIR",
      estrategiaPreco: "FIXO",
      precoFixoCentavos: 900,
      descontoPontosBase: null,
      quantidadeMinima: 1,
      quantidadeMaxima: null,
      multiploVenda: 1,
      quantidadePorEmbalagem: 1,
      unidadeComercial: "UN",
      unidadesBaseNumerador: 1,
      unidadesBaseDenominador: 1,
    }],
    ...parcial,
  };
}

function resolver(atribuicoes: AtribuicaoResolucaoB2B[], quantidade = 1) {
  return resolverOfertaB2B({
    agora,
    empresaId: "empresa-1",
    unidadeId: "unidade-1",
    produtoId: "produto-1",
    varianteId: "variante-1",
    quantidade,
    precoBaseCentavos: 1_001,
    atribuicoes,
  });
}

describe("precedência do catálogo B2B", () => {
  test("ignora versão futura e expirada no intervalo fechado-aberto", () => {
    const futura = atribuicao({ id: "futura", prioridade: 99, vigenteDesde: new Date("2026-10-19T00:00:00.000Z") });
    const expirada = atribuicao({ id: "expirada", prioridade: 98, vigenteAte: agora });
    const vigente = atribuicao({ id: "vigente", catalogoVersaoId: "vigente", prioridade: 1 });

    const resultado = resolver([futura, expirada, vigente]);

    assert.equal(resultado.tipo, "OFERTA_B2B");
    assert.equal(resultado.tipo === "OFERTA_B2B" ? resultado.catalogoVersaoId : null, "vigente");
  });

  test("unidade vence empresa mesmo quando a empresa tem prioridade maior", () => {
    const empresa = atribuicao({ id: "empresa", prioridade: 100 });
    const unidade = atribuicao({ id: "unidade", unidadeId: "unidade-1", prioridade: 0, catalogoVersaoId: "unidade" });

    const resultado = resolver([empresa, unidade]);

    assert.equal(resultado.tipo === "OFERTA_B2B" ? resultado.catalogoVersaoId : null, "unidade");
  });

  test("maior prioridade, maior versão e menor ID formam desempate total", () => {
    const baixa = atribuicao({ id: "baixa", prioridade: 1, versao: 99 });
    const antiga = atribuicao({ id: "antiga", prioridade: 2, versao: 2 });
    const zeta = atribuicao({ id: "zeta", prioridade: 2, versao: 3, catalogoVersaoId: "zeta" });
    const alfa = atribuicao({ id: "alfa", prioridade: 2, versao: 3, catalogoVersaoId: "alfa" });

    const resultado = resolver([zeta, baixa, alfa, antiga]);

    assert.equal(resultado.tipo === "OFERTA_B2B" ? resultado.catalogoVersaoId : null, "alfa");
  });
});

describe("preço e item aplicável", () => {
  test("preço fixo e desconto usam centavos inteiros com metade para cima", () => {
    const fixo = resolver([atribuicao()]);
    const desconto = resolver([atribuicao({
      itens: [{ ...atribuicao().itens[0], id: "desconto", estrategiaPreco: "DESCONTO", precoFixoCentavos: null, descontoPontosBase: 2_500 }],
    })]);

    assert.deepEqual(
      [fixo.tipo === "OFERTA_B2B" ? fixo.precoUnitarioCentavos : null, desconto.tipo === "OFERTA_B2B" ? desconto.precoUnitarioCentavos : null],
      [900, 751],
    );
  });

  test("variante exata vence regra geral e faixa mais específica vence a ampla", () => {
    const geral = atribuicao().itens[0];
    const resultado = resolver([atribuicao({ itens: [
      geral,
      { ...geral, id: "faixa-ampla", varianteId: "variante-1", quantidadeMinima: 5, precoFixoCentavos: 800 },
      { ...geral, id: "faixa-especifica", varianteId: "variante-1", quantidadeMinima: 10, precoFixoCentavos: 700 },
    ] })], 12);

    assert.deepEqual(
      resultado.tipo === "OFERTA_B2B" ? [resultado.itemId, resultado.precoUnitarioCentavos, resultado.totalCentavos] : null,
      ["faixa-especifica", 700, 8_400],
    );
  });
});

describe("restrições comerciais", () => {
  test("recusa abaixo do mínimo, acima do máximo e fora do múltiplo", () => {
    const item = { ...atribuicao().itens[0], quantidadeMinima: 5, quantidadeMaxima: 20, multiploVenda: 5 };

    assert.deepEqual([resolver([atribuicao({ itens: [item] })], 4), resolver([atribuicao({ itens: [item] })], 21), resolver([atribuicao({ itens: [item] })], 6)].map((r) => r.tipo === "INDISPONIVEL" ? r.motivo : null), ["MINIMO", "MAXIMO", "MULTIPLO"]);
  });

  test("exclusão explícita vence inclusão no mesmo catálogo", () => {
    const item = atribuicao().itens[0];
    const resultado = resolver([atribuicao({ itens: [item, { ...item, id: "bloqueio", acao: "EXCLUIR" }] })]);

    assert.deepEqual(resultado, { tipo: "INDISPONIVEL", motivo: "EXCLUIDO", catalogoVersaoId: "versao-base", itemId: "bloqueio" });
  });

  test("sem atribuição ou item aplicável preserva o preço público B2C", () => {
    const nenhuma = resolver([]);
    const outroProduto = resolver([atribuicao({ itens: [{ ...atribuicao().itens[0], produtoId: "outro" }] })], 2);

    assert.deepEqual(nenhuma, { tipo: "OFERTA_PUBLICA", precoUnitarioCentavos: 1_001, totalCentavos: 1_001 });
    assert.deepEqual(outroProduto, { tipo: "OFERTA_PUBLICA", precoUnitarioCentavos: 1_001, totalCentavos: 2_002 });
  });

  test("conversão e kit são metadados racionais e não arredondam unidades-base", () => {
    const resultado = resolver([atribuicao({ itens: [{
      ...atribuicao().itens[0], quantidadePorEmbalagem: 12, unidadeComercial: "CX", unidadesBaseNumerador: 12, unidadesBaseDenominador: 1,
      componentes: [{ varianteId: "componente-1", quantidadeBaseNumerador: 3, quantidadeBaseDenominador: 2 }],
    }] })], 2);

    assert.deepEqual(resultado.tipo === "OFERTA_B2B" ? [resultado.unidadesBaseNumerador, resultado.unidadesBaseDenominador, resultado.componentes] : null, [
      24, 1, [{ varianteId: "componente-1", quantidadeBaseNumerador: 3, quantidadeBaseDenominador: 1 }],
    ]);
  });
});
