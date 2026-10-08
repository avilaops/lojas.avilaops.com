import assert from "node:assert/strict";
import test from "node:test";
import { fichaDoProduto, formatarMm } from "./ficha";

test("medida sai formatada, com unidade e antes do resto", () => {
  const f = fichaDoProduto({ ncm: "40169300", alturaMm: "14.3", diametroInternoMm: "101.6", diametroExternoMm: "139.75" });
  assert.deepEqual(f.map((l) => [l.rotulo, l.valor]), [
    ["Diâmetro interno", "101,6 mm"],
    ["Diâmetro externo", "139,75 mm"],
    ["Altura", "14,3 mm"],
    ["NCM", "40169300"],
  ]);
  assert.equal(f[0].numero, 101.6);
  assert.equal(f[0].unidade, "mm");
});

test("chave interna do ERP não aparece", () => {
  const f = fichaDoProduto({ grupoLegado: "Diversos", _origem: "csv", unidade: "PC" });
  assert.deepEqual(f.map((l) => l.rotulo), ["Unidade de venda"]);
});

test("custo, margem e fornecedor não vão para a vitrine", () => {
  const f = fichaDoProduto({ custoCompra: 59.99, margem: "40%", fornecedor: "Distribuidora X", precoCusto: 10, unidade: "MT" });
  assert.deepEqual(f.map((l) => l.rotulo), ["Unidade de venda"]);
});

test("medida inválida some em vez de sair errada", () => {
  // O código lido como medida: melhor ausente que "5.176.168 mm".
  assert.deepEqual(fichaDoProduto({ diametroInternoMm: "5176168" }), []);
  assert.deepEqual(fichaDoProduto({ alturaMm: "0" }), []);
});

test("sem zeros à toa", () => {
  assert.equal(formatarMm(14), "14 mm");
  assert.equal(formatarMm(15.875), "15,875 mm");
});

test("rótulo gerado da chave sai acentuado, com sigla e unidade", () => {
  const f = fichaDoProduto({
    codigoFabricante: "2050652", estadoFisico: "Líquido", classificacaoGhs: "Não classificado",
    fixacao: "Velcro", diametroMm: "133", rotativaRpm: "1.500", codigoOnu: "UN 3264",
    notificacaoAnvisa: "25351", emissaoDePo: "Baixa", cor: "Azul",
  });
  assert.deepEqual(f.map((l) => l.rotulo), [
    "Código fabricante", "Estado físico", "Classificação GHS", "Fixação", "Diâmetro (mm)",
    "Rotativa (RPM)", "Código ONU", "Notificação ANVISA", "Emissão de pó", "Cor",
  ]);
});

test("GTIN não se repete como característica", () => {
  assert.deepEqual(fichaDoProduto({ gtin: "7898511028094", tipo: "Descontaminante" }).map((l) => l.rotulo), ["Tipo"]);
});

/**
 * Medido na PK Vedações em 08/10/2026: a ficha, o JSON-LD e o `product_detail`
 * do feed saíam com "Catalogo numero" e "Secao (pol)".
 */
test("número de catálogo e seção saem acentuados", () => {
  const f = fichaDoProduto({
    catalogoNumero: "B-0070", secaoMm: "5.33", secaoPol: "0.210", secaoTransversal: "Quadrada",
    referencia: "PKG.0070", grupo: "Gaxeta", subgrupo: "PU - Tipo B", alturaPol: "0.25",
  });
  assert.deepEqual(f.map((l) => [l.rotulo, l.valor]), [
    ["Seção do cordão", "5,33 mm"],
    ["Referência", "PKG.0070"],
    ["Número de catálogo", "B-0070"],
    ["Grupo", "Gaxeta"],
    ["Subgrupo", "PU - Tipo B"],
    ["Seção transversal", "Quadrada"],
    ["Seção do cordão (pol)", "0.210"],
    ["Altura (pol)", "0.25"],
  ]);
});

test("a ficha técnica sai na ordem de catálogo: medida, aplicação, códigos e polegadas por último", () => {
  const linhas = fichaDoProduto({
    grupo: "Vedações hidráulicas", alturaPol: "3/8", dureza: "85 a 93 Shore A", alturaMm: 9.52, referencia: "25002000-375",
    material: "Poliuretano (PU)", pressaoMaxima: "400 bar", diametroInternoMm: 50.8, cor: "Azul",
  });
  assert.deepEqual(linhas.map((l) => l.chave), ["diametroInternoMm", "alturaMm", "material", "dureza", "pressaoMaxima", "referencia", "grupo", "cor", "alturaPol"]);
});
