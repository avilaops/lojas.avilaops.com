import assert from "node:assert/strict";
import test from "node:test";
import type { ProdutoCatalogo } from "./catalogo-qualidade";
import { relatorioDeGovernanca } from "./catalogo-governanca";

type Opcoes = {
  id?: string;
  nome?: string;
  categoria?: string;
  sku?: string | null;
  precoCentavos?: number;
  estoque?: number | null | "sem_saldo";
  atributos?: Record<string, unknown>;
  ncm?: string | null;
};

function produto(opcoes: Opcoes = {}): ProdutoCatalogo {
  const id = opcoes.id ?? "produto-1";
  const sku = opcoes.sku === undefined ? "RET-001" : opcoes.sku;
  const estoque = opcoes.estoque === undefined ? 4 : opcoes.estoque;
  const saldos = estoque === "sem_saldo" ? [] : [{
    id: `saldo-${id}`, tenantId: "loja-1", varianteId: `variante-${id}`,
    local: "principal", fisico: estoque, reservado: 0, atualizadoEm: new Date(),
  }];
  return {
    id,
    tenantId: "loja-1",
    nome: opcoes.nome ?? "Retentor industrial 20 x 35 x 7",
    slug: id,
    ativo: true,
    categoriaId: `categoria-${id}`,
    categoria: {
      id: `categoria-${id}`, tenantId: "loja-1", slug: "retentores",
      nome: opcoes.categoria ?? "Retentores", descricao: null, imagemUrl: null,
      ordem: 0, seoTitle: null, seoDescription: null, seoKeywords: [],
      seoPendente: false, seoOrigem: null, seoModelo: null,
      seoAtualizadoEm: null, seoProcessandoEm: null, seoErro: null,
      criadoEm: new Date(), atualizadoEm: new Date(),
    },
    marca: "Sabó",
    sku,
    gtin: null,
    ncm: opcoes.ncm === undefined ? "40169300" : opcoes.ncm,
    cest: null,
    googleProductCategory: "6732",
    precoCentavos: opcoes.precoCentavos ?? 1000,
    precoDeCentavos: null,
    descricaoCurta: "Vedação para aplicação industrial.",
    descricao: null,
    imagens: ["https://cdn.example/item.jpg"],
    imagemOrigem: "propria",
    imagemFamilia: null,
    atributos: {
      unidade: "UN",
      diametroInternoMm: 20,
      diametroExternoMm: 35,
      alturaMm: 7,
      ...opcoes.atributos,
    },
    opcoes: [],
    midias: [{
      id: `midia-${id}`, tenantId: "loja-1", produtoId: id,
      varianteId: null, escopo: "produto", url: "https://cdn.example/item.jpg",
      tipo: "imagem", finalidade: "principal", ordem: 0, origem: "propria",
      familia: null, textoAlternativo: null, fonte: "teste",
      correspondencia: "confirmada", larguraPx: 1000, alturaPx: 1000,
      criadoEm: new Date(),
    }],
    variantes: [{
      id: `variante-${id}`, tenantId: "loja-1", produtoId: id,
      padrao: true, valores: {}, nome: "Única", sku, gtin: null, mpn: null,
      identificadoresEstado: "sem_identificador", disponibilidade: "in_stock",
      ativo: true, ordem: 0,
      preco: {
        varianteId: `variante-${id}`, tenantId: "loja-1", moeda: "BRL",
        valorCentavos: opcoes.precoCentavos ?? 1000,
        comparacaoCentavos: null, atualizadoEm: new Date(),
      },
      saldos,
      publicacoes: [],
    }],
  } as unknown as ProdutoCatalogo;
}

test("gera uma linha completa por SKU ativo e cobertura determinística", () => {
  const relatorio = relatorioDeGovernanca([produto()]);

  assert.equal(relatorio.linhas.length, 1);
  assert.deepEqual(
    {
      sku: relatorio.linhas[0].sku,
      familia: relatorio.linhas[0].familia,
      estado: relatorio.linhas[0].estado,
      medidas: relatorio.linhas[0].campos.medidas,
      unidade: relatorio.linhas[0].campos.unidade,
      ncm: relatorio.linhas[0].campos.ncm,
    },
    { sku: "RET-001", familia: "retentor", estado: "COM_AVISOS", medidas: true, unidade: true, ncm: true },
  );
  assert.equal(relatorio.resumo.skus, 1);
  assert.equal(relatorio.resumo.coberturaPercentual, 100);
  assert.equal(relatorio.coberturaPorCampo.medidas.percentual, 100);
});

test("aplica medidas obrigatórias específicas para retentor e rolamento sem inferir pelo nome", () => {
  const retentor = produto({ id: "retentor", atributos: { alturaMm: null } });
  const rolamento = produto({
    id: "rolamento",
    categoria: "Rolamentos",
    sku: "ROL-6204",
    atributos: { diametroInternoMm: 20, diametroExternoMm: 47, alturaMm: null },
  });

  const relatorio = relatorioDeGovernanca([retentor, rolamento]);

  assert.equal(relatorio.linhas.find((l) => l.sku === "RET-001")?.campos.medidas, false);
  assert.equal(relatorio.linhas.find((l) => l.sku === "ROL-6204")?.campos.medidas, false);
  assert.ok(relatorio.linhas.every((l) => l.ocorrencias.some((o) => o.regra === "medidas_familia_ausentes")));
});

test("detecta SKU normalizado duplicado entre produtos e conflito de preço", () => {
  const relatorio = relatorioDeGovernanca([
    produto({ id: "a", sku: " ret-001 ", precoCentavos: 1000 }),
    produto({ id: "b", sku: "RET.001", precoCentavos: 1250 }),
  ]);

  assert.equal(relatorio.resumo.duplicidades, 1);
  assert.equal(relatorio.resumo.conflitosPreco, 1);
  assert.deepEqual(relatorio.conflitos[0], {
    skuNormalizado: "RET001",
    produtoIds: ["a", "b"],
    skus: ["ret-001", "RET.001"],
    precosCentavos: [1000, 1250],
  });
  assert.ok(relatorio.linhas.every((l) => l.estado === "BLOQUEADO"));
});

test("não trata SKU repetido no produto e na variante padrão como duplicidade", () => {
  const relatorio = relatorioDeGovernanca([produto({ sku: "ABC-10" })]);
  assert.equal(relatorio.resumo.duplicidades, 0);
  assert.equal(relatorio.conflitos.length, 0);
});

test("saldo explicitamente não controlado conta como configuração de estoque; ausência de saldo não", () => {
  const relatorio = relatorioDeGovernanca([
    produto({ id: "nao-controlado", sku: "NC-1", estoque: null }),
    produto({ id: "ausente", sku: "SE-1", estoque: "sem_saldo" }),
  ]);

  assert.equal(relatorio.linhas.find((l) => l.sku === "NC-1")?.campos.estoque, true);
  assert.equal(relatorio.linhas.find((l) => l.sku === "NC-1")?.estoqueControlado, false);
  assert.equal(relatorio.linhas.find((l) => l.sku === "SE-1")?.campos.estoque, false);
});

test("mantém produto sem SKU no relatório e mede cobertura por família e campo", () => {
  const relatorio = relatorioDeGovernanca([
    produto(),
    produto({ id: "sem-sku", sku: null, ncm: null }),
  ]);

  assert.equal(relatorio.linhas.length, 2);
  assert.equal(relatorio.linhas[1].chave, "produto:sem-sku:variante:variante-sem-sku");
  assert.equal(relatorio.linhas[1].estado, "BLOQUEADO");
  assert.equal(relatorio.coberturaPorCampo.sku.preenchidos, 1);
  assert.equal(relatorio.coberturaPorCampo.sku.total, 2);
  assert.equal(relatorio.coberturaPorCampo.sku.percentual, 50);
  assert.deepEqual(relatorio.coberturaPorFamilia.map((f) => f.familia), ["retentor"]);
  assert.equal(relatorio.coberturaPorFamilia[0].skus, 2);
});

test("não contabiliza NCM ou medida técnica malformados como cobertura", () => {
  const relatorio = relatorioDeGovernanca([produto({
    categoria: "Ferramentas",
    ncm: "NCM desconhecido",
    atributos: {
      diametroInternoMm: "não medido",
      diametroExternoMm: null,
      alturaMm: null,
    },
  })]);

  assert.equal(relatorio.linhas[0].campos.ncm, false);
  assert.equal(relatorio.linhas[0].campos.medidas, false);
  assert.equal(relatorio.linhas[0].estado, "BLOQUEADO");
});
