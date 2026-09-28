import assert from "node:assert/strict";
import test from "node:test";
import { inflateRawSync } from "node:zlib";
import { COLUNAS_PRODUTO, lerCsvProdutos } from "./planilha-produtos";
import { linhaDoProduto, montarPlanilha, type ProdutoDePlanilha } from "./exportar";
import { letraDaColuna, montarXlsx } from "./xlsx";

/**
 * A planilha do catálogo é um ciclo, não uma saída: o lojista baixa, corrige
 * mil preços no Excel e devolve o arquivo. O que estes testes protegem é a
 * volta — coluna que muda de nome, estoque que vira zero ou destaque que some
 * só aparecem depois que o catálogo já foi gravado errado.
 */

const PRODUTO: ProdutoDePlanilha = {
  nome: "Rolamento 6205 2RS",
  precoCentavos: 5990,
  precoDeCentavos: 7990,
  marca: "SKF",
  sku: "ROL6205",
  gtin: "0789123456789",
  descricaoCurta: "Rolamento rígido de esferas",
  descricao: "Medidas 25x52x15; vedação dupla",
  imagens: ["https://exemplo.com/6205.jpg", "https://exemplo.com/6205-b.jpg"],
  destaque: true,
  ativo: true,
  estoque: 12,
  pesoKg: 0.13,
  alturaCm: 1.5,
  larguraCm: 5.2,
  comprimentoCm: 5.2,
  categoria: { nome: "Rolamentos" },
  correspondenciaImagem: "nao_confirmada",
};

function planilhaDe(produtos: ProdutoDePlanilha[]): string {
  return montarPlanilha([[...COLUNAS_PRODUTO], ...produtos.map(linhaDoProduto)], "csv", "Produtos") as string;
}

test("o catálogo exportado volta inteiro pela importação", () => {
  const { produtos, erros } = lerCsvProdutos(planilhaDe([PRODUTO]));
  assert.deepEqual(erros, []);
  assert.equal(produtos.length, 1);
  const p = produtos[0];
  assert.equal(p.nome, PRODUTO.nome);
  assert.equal(p.precoCentavos, 5990);
  assert.equal(p.precoDeCentavos, 7990);
  assert.equal(p.categoria, "Rolamentos");
  assert.equal(p.marca, "SKF");
  assert.equal(p.sku, "ROL6205");
  assert.equal(p.gtin, "0789123456789");
  assert.equal(p.descricaoCurta, PRODUTO.descricaoCurta);
  assert.deepEqual(p.imagens, PRODUTO.imagens);
  assert.equal(p.correspondenciaImagem, "nao_confirmada");
  assert.equal(p.destaque, true);
  assert.equal(p.ativo, true);
  assert.equal(p.estoque, 12);
  assert.equal(p.pesoKg, 0.13);
  assert.equal(p.alturaCm, 1.5);
  assert.equal(p.larguraCm, 5.2);
  assert.equal(p.comprimentoCm, 5.2);
});

test("preço com ponto e vírgula na descrição não desloca as colunas", () => {
  const { produtos } = lerCsvProdutos(planilhaDe([{ ...PRODUTO, descricao: "Medidas 25;52;15" }]));
  assert.equal(produtos[0].descricao, "Medidas 25;52;15");
  assert.equal(produtos[0].precoCentavos, 5990);
});

test("estoque sem controle não volta como zero", () => {
  // `∞` na tela é "não controlo estoque". Voltar como 0 esgotaria o produto na
  // vitrine no dia seguinte à importação.
  const { produtos } = lerCsvProdutos(planilhaDe([{ ...PRODUTO, estoque: null }]));
  assert.equal("estoque" in produtos[0], false);
});

test("medida em branco continua em branco", () => {
  const sem = { ...PRODUTO, pesoKg: null, alturaCm: null, larguraCm: null, comprimentoCm: null };
  const { produtos } = lerCsvProdutos(planilhaDe([sem]));
  for (const campo of ["pesoKg", "alturaCm", "larguraCm", "comprimentoCm"]) {
    assert.equal(campo in produtos[0], false, `${campo} não deveria ser escrito`);
  }
});

test("planilha de fornecedor sem a coluna destaque não tira a estrela de ninguém", () => {
  const { produtos } = lerCsvProdutos("nome;preco\r\nRolamento 6205 2RS;59,90\r\n");
  assert.equal("destaque" in produtos[0], false);
  assert.equal(produtos[0].precoCentavos, 5990);
});

test("o BOM do arquivo que o painel grava não come a coluna nome", () => {
  const { produtos, erros } = lerCsvProdutos("﻿nome;preco\r\nCamiseta;79,90\r\n");
  assert.deepEqual(erros, []);
  assert.equal(produtos[0].nome, "Camiseta");
});

test("ativo aceita sim e não, e em branco não mexe no produto", () => {
  const lido = (valor: string) => lerCsvProdutos(`nome;preco;ativo\r\nX;10,00;${valor}\r\n`).produtos[0];
  assert.equal(lido("sim").ativo, true);
  assert.equal(lido("nao").ativo, false);
  assert.equal("ativo" in lido(""), false);
});

test("planilha importa o estado incorreto da imagem e rejeita valores desconhecidos", () => {
  const rejeitada = lerCsvProdutos("sku;correspondencia_imagem\r\nROL6205;rejeitada\r\n");
  assert.deepEqual(rejeitada.erros, []);
  assert.equal(rejeitada.produtos[0].correspondenciaImagem, "rejeitada");
  const invalida = lerCsvProdutos("sku;correspondencia_imagem\r\nROL6205;talvez\r\n");
  assert.match(invalida.erros[0], /correspondencia_imagem/);
});

/** Lê o zip que o `montarXlsx` grava, pelos cabeçalhos locais. */
function abrirZip(bytes: Uint8Array): Map<string, string> {
  const arquivo = Buffer.from(bytes);
  const partes = new Map<string, string>();
  let i = 0;
  while (i + 30 <= arquivo.length && arquivo.readUInt32LE(i) === 0x04034b50) {
    const tamanhoNome = arquivo.readUInt16LE(i + 26);
    const tamanhoExtra = arquivo.readUInt16LE(i + 28);
    const comprimido = arquivo.readUInt32LE(i + 18);
    const nome = arquivo.subarray(i + 30, i + 30 + tamanhoNome).toString("utf8");
    const inicio = i + 30 + tamanhoNome + tamanhoExtra;
    partes.set(nome, inflateRawSync(arquivo.subarray(inicio, inicio + comprimido)).toString("utf8"));
    i = inicio + comprimido;
  }
  return partes;
}

test("o xlsx é um pacote que o Excel sabe abrir", () => {
  const partes = abrirZip(montarXlsx([["Nome", "Total"], ["Camiseta", 79.9]], { aba: "Produtos" }));
  for (const parte of ["[Content_Types].xml", "_rels/.rels", "xl/workbook.xml", "xl/_rels/workbook.xml.rels", "xl/styles.xml", "xl/worksheets/sheet1.xml"]) {
    assert.ok(partes.has(parte), `faltou ${parte}`);
  }
  assert.match(partes.get("xl/workbook.xml")!, /name="Produtos"/);
  const folha = partes.get("xl/worksheets/sheet1.xml")!;
  assert.match(folha, /<c r="A1" s="1" t="inlineStr"><is><t xml:space="preserve">Nome<\/t><\/is><\/c>/);
  // Número continua número: é o que deixa o Excel somar a coluna.
  assert.match(folha, /<c r="B2"><v>79.9<\/v><\/c>/);
  assert.match(folha, /state="frozen"/);
});

test("código com zero à esquerda sobrevive ao xlsx", () => {
  // No CSV o Excel transforma "0789123456789" em 7,89123E+11. Aqui a célula
  // diz que é texto, e o GTIN volta inteiro para a importação.
  const folha = abrirZip(montarXlsx([["gtin"], ["0789123456789"]])).get("xl/worksheets/sheet1.xml")!;
  assert.match(folha, /t="inlineStr"><is><t xml:space="preserve">0789123456789</);
});

test("o xml da planilha escapa o que o lojista digitou", () => {
  const folha = abrirZip(montarXlsx([["nome"], ['Kit 3" & 5" <promo>']])).get("xl/worksheets/sheet1.xml")!;
  assert.match(folha, /Kit 3" &amp; 5" &lt;promo&gt;/);
  assert.doesNotMatch(folha, /<promo>/);
});

test("a coluna 27 é AA", () => {
  assert.equal(letraDaColuna(0), "A");
  assert.equal(letraDaColuna(25), "Z");
  assert.equal(letraDaColuna(26), "AA");
  assert.equal(letraDaColuna(27), "AB");
});
