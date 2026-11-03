import assert from "node:assert/strict";
import test from "node:test";
import type { ProdutoCatalogo } from "./catalogo-qualidade";
import { relatorioDeGovernanca, type LinhaGovernancaCatalogo } from "./catalogo-governanca";

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

test("medidas rejeitam booleanos, arrays e valores acima do teto técnico", () => {
  for (const categoria of ["Retentores", "O-rings", "Rolamentos", "Ferramentas"]) {
    for (const valor of [true, [20], { valor: 20 }, 3001]) {
      const relatorio = relatorioDeGovernanca([produto({
        categoria,
        atributos: { diametroInternoMm: valor, diametroExternoMm: null, alturaMm: null },
      })]);

      assert.equal(relatorio.linhas[0].campos.medidas, false, `${categoria}: ${JSON.stringify(valor)}`);
    }
  }
});

test("retentor não aceita booleano como diâmetro mesmo com as outras medidas preenchidas", () => {
  const relatorio = relatorioDeGovernanca([produto({ atributos: { diametroInternoMm: true } })]);

  assert.equal(relatorio.linhas[0].campos.medidas, false);
  assert.ok(relatorio.linhas[0].ocorrencias.some((o) => o.regra === "medidas_familia_ausentes"));
});

test("preserva medidas decimais legadas em texto e NCM formatado", () => {
  const relatorio = relatorioDeGovernanca([produto({
    ncm: "4016.93.00",
    atributos: { diametroInternoMm: "20.5", diametroExternoMm: "35", alturaMm: "7" },
  })]);

  assert.equal(relatorio.linhas[0].campos.medidas, true);
  assert.equal(relatorio.linhas[0].campos.ncm, true);
  assert.equal(relatorio.resumo.coberturaPercentual, 100);
});

test("NCM com letras entre os dígitos não conta como preenchido", () => {
  const relatorio = relatorioDeGovernanca([produto({ ncm: "4016abc9300" })]);

  assert.equal(relatorio.linhas[0].campos.ncm, false);
  assert.equal(relatorio.linhas[0].estado, "BLOQUEADO");
});

test("unidade exige texto e não aceita tipos JSON arbitrários", () => {
  for (const unidade of [true, 1, {}, ["UN"]]) {
    const relatorio = relatorioDeGovernanca([produto({ atributos: { unidade } })]);
    assert.equal(relatorio.linhas[0].campos.unidade, false, JSON.stringify(unidade));
  }
  const legado = relatorioDeGovernanca([produto({ atributos: { unidade: null, unidadeVenda: " UN " } })]);
  assert.equal(legado.linhas[0].campos.unidade, true);
});

test("dimensões da embalagem não suprem as medidas técnicas de outras famílias", () => {
  const relatorio = relatorioDeGovernanca([produto({
    categoria: "Ferramentas",
    atributos: {
      diametroInternoMm: null, diametroExternoMm: null, alturaMm: null,
      comprimentoCm: 20, larguraCm: 10, alturaCm: 5,
    },
  })]);

  assert.equal(relatorio.linhas[0].campos.medidas, false);
});

test("anel O e anéis O exigem todas as medidas da família O-ring", () => {
  for (const categoria of ["Anel O", "Anéis O", "O-ring", "O-rings"]) {
    const relatorio = relatorioDeGovernanca([produto({ categoria, atributos: { alturaMm: null } })]);
    assert.equal(relatorio.linhas[0].familia, "oring", categoria);
    assert.equal(relatorio.linhas[0].campos.medidas, false, categoria);
  }
});

test("cobertura vazia é explícita e variantes inativas não entram no denominador", () => {
  const inativo = produto();
  inativo.variantes[0].ativo = false;
  for (const produtos of [[], [inativo]]) {
    const relatorio = relatorioDeGovernanca(produtos);
    assert.equal(relatorio.resumo.skus, 0);
    assert.equal(relatorio.resumo.camposObrigatorios, 0);
    assert.equal(relatorio.resumo.coberturaPercentual, 100);
    assert.deepEqual(relatorio.coberturaPorCampo.medidas, { preenchidos: 0, total: 0, percentual: 100 });
    assert.deepEqual(relatorio.linhas, []);
  }
});

test("cada campo obrigatório ausente reduz a cobertura e gera ocorrência crítica por SKU", () => {
  const casos: Array<{
    campo: keyof LinhaGovernancaCatalogo["campos"];
    remover: (p: ProdutoCatalogo) => void;
  }> = [
    { campo: "nome", remover: (p) => { p.nome = " "; } },
    { campo: "categoria", remover: (p) => { p.categoriaId = null; p.categoria = null; } },
    { campo: "marca", remover: (p) => { p.marca = null; } },
    { campo: "sku", remover: (p) => { p.sku = null; p.variantes[0].sku = null; } },
    { campo: "unidade", remover: (p) => { p.atributos = { diametroInternoMm: 20, diametroExternoMm: 35, alturaMm: 7 }; } },
    { campo: "ncm", remover: (p) => { p.ncm = null; } },
    { campo: "descricao", remover: (p) => { p.descricao = null; p.descricaoCurta = null; } },
    { campo: "imagem", remover: (p) => { p.midias = []; } },
    { campo: "estoque", remover: (p) => { p.variantes[0].saldos = []; } },
    { campo: "preco", remover: (p) => { p.variantes[0].preco = null; } },
    { campo: "medidas", remover: (p) => { p.atributos = { unidade: "UN" }; } },
  ];

  for (const { campo, remover } of casos) {
    const p = produto();
    remover(p);
    const relatorio = relatorioDeGovernanca([p]);
    assert.equal(relatorio.linhas[0].campos[campo], false, campo);
    assert.equal(relatorio.linhas[0].estado, "BLOQUEADO", campo);
    assert.ok(relatorio.linhas[0].ocorrencias.some((o) => o.campo === campo && o.severidade === "erro"), campo);
    assert.equal(relatorio.resumo.camposObrigatorios, 11, campo);
    assert.equal(relatorio.resumo.camposPreenchidos, 10, campo);
    assert.equal(relatorio.resumo.coberturaPercentual, 90.91, campo);
  }
});

test("aceita seção do O-ring e largura do rolamento e separa a cobertura por família", () => {
  const relatorio = relatorioDeGovernanca([
    produto({ categoria: "O-rings", atributos: { alturaMm: null, secaoMm: 2.4, unidade: null } }),
    produto({
      id: "rolamento", categoria: "Rolamentos", sku: "ROL-6204",
      atributos: { diametroInternoMm: null, diametroInternoRolamentoMm: 20, alturaMm: null, larguraMm: 14 },
    }),
  ]);

  assert.ok(relatorio.linhas.every((linha) => linha.campos.medidas));
  assert.equal(relatorio.resumo.camposObrigatorios, 22);
  assert.equal(relatorio.resumo.camposPreenchidos, 21);
  assert.equal(relatorio.resumo.coberturaPercentual, 95.45);
  assert.deepEqual(relatorio.coberturaPorFamilia, [
    { familia: "oring", skus: 1, preenchidos: 10, total: 11, percentual: 90.91, bloqueados: 1 },
    { familia: "rolamento", skus: 1, preenchidos: 11, total: 11, percentual: 100, bloqueados: 0 },
  ]);
});
