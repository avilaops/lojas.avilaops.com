import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { LAYOUTS, TemaSchema } from "./tema";
import { CONTRATOS } from "./templates";
import { aplicacaoDe, colunasVisiveis, linhaTecnica, medidasDe, type ProdutoTecnico } from "./catalogo-tecnico";

/**
 * O catálogo técnico é uma tabela montada só com o que o produto já tem. Estes
 * testes prendem o texto de cada célula e a regra que mantém o template sem
 * lista de lojas: coluna que ninguém preenche some.
 */

const produto = (extra: Partial<ProdutoTecnico> = {}): ProdutoTecnico => ({
  slug: "rolamento-6203",
  nome: "Rolamento 6203",
  marca: null,
  sku: null,
  codigoOriginal: null,
  codigosEquivalentes: [],
  compatibilidade: [],
  atributos: {},
  ...extra,
});

test("medidas: a da peça (atributos), na forma do balcão", () => {
  assert.equal(medidasDe({ atributos: { diametroInternoMm: 25, diametroExternoMm: 52, alturaMm: 15 } }), "25 × 52 × 15 mm");
  assert.equal(medidasDe({ atributos: {} }), null);
  assert.equal(medidasDe({}), null);
  assert.equal(medidasDe(null), null);
});

test("medidas: a caixa do frete não é a medida da peça", () => {
  // Peso e dimensões de embalagem existem para cotar frete. Mostrados na
  // coluna "Medidas", um 6205 (25 × 52 × 15 mm) aparecia como a caixa dele.
  const linha = linhaTecnica({ ...produto(), comprimentoCm: 12, larguraCm: 8, alturaCm: 3, pesoKg: 0.45 } as ProdutoTecnico);
  assert.equal(linha.medidas, null);
});

test("aplicação: sem compatibilidade é Universal", () => {
  assert.deepEqual(aplicacaoDe({ compatibilidade: [] }), { texto: "Universal", restantes: 0 });
});

test("aplicação: mostra até o limite e conta o resto", () => {
  const compatibilidade = [
    { marca: "Honda", modelo: "CG 160", anoDe: 2016, anoAte: 2024 },
    { marca: "Yamaha", modelo: "Fazer 250" },
    { marca: "Honda", modelo: "Biz 125" },
    { marca: "Honda", modelo: "Pop 110i", anoDe: 2019 },
    { marca: "Suzuki", modelo: "Yes 125" },
  ];
  assert.deepEqual(aplicacaoDe({ compatibilidade }), { texto: "Honda CG 160 (2016–2024), Yamaha Fazer 250", restantes: 3 });
  assert.deepEqual(aplicacaoDe({ compatibilidade }, 1), { texto: "Honda CG 160 (2016–2024)", restantes: 4 });
  assert.equal(aplicacaoDe({ compatibilidade }, 10).restantes, 0);
  // Limite sem sentido não esvazia a célula.
  assert.deepEqual(aplicacaoDe({ compatibilidade }, 0), { texto: "Honda CG 160 (2016–2024)", restantes: 4 });
});

test("aplicação: entrada inválida não lança", () => {
  for (const ruim of [null, undefined, "Honda CG", 42, {}, [null, "x", { marca: "Honda" }]]) {
    assert.deepEqual(aplicacaoDe({ compatibilidade: ruim }), { texto: "Universal", restantes: 0 });
  }
  assert.deepEqual(aplicacaoDe(null), { texto: "Universal", restantes: 0 });
});

test("linha técnica junta os dados do produto e limpa o que veio em branco", () => {
  const linha = linhaTecnica(produto({
    marca: " NSK ", sku: "6203-2RS", codigoOriginal: "91003-KGH-901", codigosEquivalentes: ["SKF 6203", " ", "FAG 6203"],
    compatibilidade: [{ marca: "Honda", modelo: "CG 160" }], atributos: { diametroInternoMm: 17, diametroExternoMm: 40, alturaMm: 12 },
  }));
  assert.deepEqual(linha, {
    slug: "rolamento-6203", nome: "Rolamento 6203", marca: "NSK", codigo: "6203-2RS", codigoOriginal: "91003-KGH-901",
    equivalentes: ["SKF 6203", "FAG 6203"], medidas: "17 × 40 × 12 mm", aplicacao: { texto: "Honda CG 160", restantes: 0 },
  });
  assert.equal(linhaTecnica(produto({ sku: "  " })).codigo, null);
});

test("colunas: some a que nenhum produto preenche", () => {
  const semNada = [linhaTecnica(produto()), linhaTecnica(produto())];
  assert.deepEqual(colunasVisiveis(semNada), []);
  assert.deepEqual(colunasVisiveis([]), []);

  const soCodigoEMedida = [linhaTecnica(produto({ sku: "A1" })), linhaTecnica(produto({ atributos: { diametroInternoMm: 20 } }))];
  assert.deepEqual(colunasVisiveis(soCodigoEMedida), ["codigo", "medidas"]);

  const completa = [linhaTecnica(produto({
    marca: "NSK", sku: "A1", codigoOriginal: "OEM-1", codigosEquivalentes: ["X"], atributos: { alturaMm: 7 },
    compatibilidade: [{ marca: "Honda", modelo: "CG 160" }],
  })), linhaTecnica(produto())];
  assert.deepEqual(colunasVisiveis(completa), ["codigo", "marca", "codigoOriginal", "equivalentes", "medidas", "aplicacao"]);
});

test("o layout existe no schema, na lista do painel e no contrato", () => {
  assert.equal(TemaSchema.parse({ layout: "catalogo-tecnico" }).layout, "catalogo-tecnico");
  const item = LAYOUTS.find((l) => l.valor === "catalogo-tecnico");
  assert.equal(item?.rotulo, "Catálogo Técnico");
  assert.ok((item?.descricao.length ?? 0) > 10);
  assert.equal(CONTRATOS["catalogo-tecnico"].escopo, "home");
});

test("nenhuma loja escrita no template", () => {
  for (const caminho of ["src/lib/catalogo-tecnico.ts", "src/components/home/CatalogoTecnico.tsx"]) {
    const fonte = readFileSync(caminho, "utf8");
    for (const proibido of ["tenant.slug", "t.slug ===", "t.id ===", ".lojas.avilaops.com", "segmento"]) {
      assert.ok(!fonte.includes(proibido), `${caminho} contém ${proibido}`);
    }
  }
});
