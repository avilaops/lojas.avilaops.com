import assert from "node:assert/strict";
import test from "node:test";
import * as zlib from "node:zlib";
import { inflateRawSync } from "node:zlib";
import { COLUNAS_PRODUTO, lerCsvProdutos, produtosDeLinhas } from "./planilha-produtos";
import { ErroPlanilha, linhasDeXlsx } from "./xlsx-leitor";
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
  assert.deepEqual(p.imagens, ["https://exemplo.com/6205.jpg"]);
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

/**
 * O caminho de volta: o arquivo que o painel baixa tem que ser aceito de
 * volta pela importação. O Excel grava o texto numa tabela compartilhada
 * (`sharedStrings`), coisa que o nosso escritor não faz — então o leitor é
 * testado contra os dois jeitos, senão ele só sabe ler o que ele mesmo
 * escreveu.
 */

/** Zip sem compressão, para montar no teste a planilha que o Excel grava. */
function zipDeTeste(arquivos: Array<{ nome: string; texto: string }>): Buffer {
  const locais: Buffer[] = [];
  const central: Buffer[] = [];
  let deslocamento = 0;
  for (const a of arquivos) {
    const nome = Buffer.from(a.nome, "utf8");
    const dados = Buffer.from(a.texto, "utf8");
    const crc = zlib.crc32 ? zlib.crc32(dados) : crc32(dados);
    const cab = Buffer.alloc(30);
    cab.writeUInt32LE(0x04034b50, 0);
    cab.writeUInt16LE(20, 4);
    cab.writeUInt16LE(0, 6);
    cab.writeUInt16LE(0, 8); // sem compressão
    cab.writeUInt32LE(crc, 14);
    cab.writeUInt32LE(dados.length, 18);
    cab.writeUInt32LE(dados.length, 22);
    cab.writeUInt16LE(nome.length, 26);
    locais.push(cab, nome, dados);

    const ent = Buffer.alloc(46);
    ent.writeUInt32LE(0x02014b50, 0);
    ent.writeUInt16LE(20, 4);
    ent.writeUInt16LE(20, 6);
    ent.writeUInt16LE(0, 10);
    ent.writeUInt32LE(crc, 16);
    ent.writeUInt32LE(dados.length, 20);
    ent.writeUInt32LE(dados.length, 24);
    ent.writeUInt16LE(nome.length, 28);
    ent.writeUInt32LE(deslocamento, 42);
    central.push(ent, nome);
    deslocamento += cab.length + nome.length + dados.length;
  }
  const diretorio = Buffer.concat(central);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  return Buffer.concat([...locais, diretorio, fim]);
}

function crc32(dados: Buffer): number {
  let c = 0xffffffff;
  for (const b of dados) {
    c ^= b;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  return (c ^ 0xffffffff) >>> 0;
}

const ABERTURA = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/** Como o Excel grava: texto na tabela compartilhada, número solto. */
function planilhaDoExcel(compartilhados: string[], linhas: string[]): Buffer {
  return zipDeTeste([
    { nome: "[Content_Types].xml", texto: `${ABERTURA}<Types/>` },
    { nome: "_rels/.rels", texto: `${ABERTURA}<Relationships/>` },
    {
      nome: "xl/workbook.xml",
      texto: `${ABERTURA}<workbook xmlns:r="r"><sheets><sheet name="Planilha1" sheetId="1" r:id="rId7"/></sheets></workbook>`,
    },
    {
      nome: "xl/_rels/workbook.xml.rels",
      texto: `${ABERTURA}<Relationships><Relationship Id="rId7" Target="worksheets/folha.xml"/></Relationships>`,
    },
    {
      nome: "xl/sharedStrings.xml",
      texto: `${ABERTURA}<sst count="${compartilhados.length}">${compartilhados.map((t) => `<si><t>${t}</t></si>`).join("")}</sst>`,
    },
    { nome: "xl/worksheets/folha.xml", texto: `${ABERTURA}<worksheet><sheetData>${linhas.join("")}</sheetData></worksheet>` },
  ]);
}

test("o .xlsx que o painel baixa volta inteiro pela importação", () => {
  const bytes = montarPlanilha([[...COLUNAS_PRODUTO], linhaDoProduto(PRODUTO)], "xlsx", "Produtos") as Uint8Array;
  const { produtos, erros } = produtosDeLinhas(linhasDeXlsx(Buffer.from(bytes)));
  assert.deepEqual(erros, []);
  const p = produtos[0];
  assert.equal(p.nome, PRODUTO.nome);
  assert.equal(p.precoCentavos, 5990);
  // O que o CSV estraga no Excel e o .xlsx guarda: o zero à esquerda.
  assert.equal(p.gtin, "0789123456789");
  assert.equal(p.sku, "ROL6205");
  assert.equal(p.estoque, 12);
  assert.equal(p.pesoKg, 0.13);
  assert.equal(p.ativo, true);
  assert.equal(p.destaque, true);
});

test("planilha gravada pelo Excel (texto compartilhado) é lida igual", () => {
  const arquivo = planilhaDoExcel(
    ["nome", "preco", "sku", "Rolamento 6205 2RS", "ROL6205"],
    [
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>',
      '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="B2"><v>59.9</v></c><c r="C2" t="s"><v>4</v></c></row>',
    ],
  );
  const { produtos, erros } = produtosDeLinhas(linhasDeXlsx(arquivo));
  assert.deepEqual(erros, []);
  assert.equal(produtos[0].nome, "Rolamento 6205 2RS");
  assert.equal(produtos[0].precoCentavos, 5990);
  assert.equal(produtos[0].sku, "ROL6205");
});

test("célula vazia no meio da linha não empurra as colunas", () => {
  // Sem respeitar o `r="C2"`, o preço cairia na coluna da categoria e o
  // catálogo inteiro entraria com o preço errado.
  const arquivo = planilhaDoExcel(
    ["nome", "categoria", "preco", "Caneca"],
    [
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>',
      '<row r="2"><c r="A2" t="s"><v>3</v></c><c r="C2"><v>34.9</v></c></row>',
    ],
  );
  const { produtos } = produtosDeLinhas(linhasDeXlsx(arquivo));
  assert.equal(produtos[0].nome, "Caneca");
  assert.equal(produtos[0].precoCentavos, 3490);
  assert.equal(produtos[0].categoria, undefined);
});

test("arquivo que não é planilha vira recado, não exceção crua", () => {
  assert.throws(() => linhasDeXlsx(Buffer.from("isto é um pdf, não uma planilha")), ErroPlanilha);
});

test("preço decimal de planilha não vira bilhão", () => {
  // 79,90 guardado como ponto flutuante numa planilha vira "79.90000000000001".
  // A regra antiga apagava o ponto seguido de três dígitos e o preço virava
  // 7.990.000.000.000.001 centavos: o banco recusava a importação inteira.
  const lido = (preco: string) => lerCsvProdutos(`nome;preco\r\nX;${preco}\r\n`).produtos[0]?.precoCentavos;
  assert.equal(lido("79.90000000000001"), 7990);
  assert.equal(lido("59,90"), 5990);
  assert.equal(lido("1.234,56"), 123456);
  assert.equal(lido("R$ 1.234,56"), 123456);
  assert.equal(lido("1234.56"), 123456);
});

test("preço maior que o banco aguenta vira linha recusada, não erro de gravação", () => {
  const { produtos, erros } = lerCsvProdutos("nome;preco\r\nCaro;99999999999\r\nNormal;10,00\r\n");
  assert.equal(produtos.length, 1);
  assert.equal(produtos[0].nome, "Normal");
  assert.match(erros[0], /Linha 2: preço fora do limite/);
});

/**
 * "Linha 312" tem que ser a linha 312 do Excel.
 *
 * É por esse número que o lojista acha o problema num arquivo de cinco mil
 * itens. A matriz engolia linha em branco (no CSV) e linha apagada (no
 * .xlsx), e o aviso passava a apontar para outro produto.
 */
test("linha em branco no meio do CSV não desloca o número do aviso", () => {
  const { produtos, erros } = lerCsvProdutos("nome;preco\r\nBom;10,00\r\n\r\nSem preço;\r\n");
  assert.equal(produtos.length, 1);
  assert.deepEqual(erros, ["Linha 4: nome ou preço ausente."]);
});

test("linha apagada no .xlsx não desloca o número do aviso", () => {
  const arquivo = planilhaDoExcel(
    ["nome", "preco", "Bom", "Sem preço"],
    [
      '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>',
      '<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2"><v>10</v></c></row>',
      // as linhas 3 e 4 foram apagadas no Excel e não existem no arquivo
      '<row r="5"><c r="A5" t="s"><v>3</v></c></row>',
    ],
  );
  const { produtos, erros } = produtosDeLinhas(linhasDeXlsx(arquivo));
  assert.equal(produtos.length, 1);
  assert.deepEqual(erros, ["Linha 5: nome ou preço ausente."]);
});

test("planilha que começa com linha em branco ainda acha o cabeçalho", () => {
  const { produtos, erros } = lerCsvProdutos("\r\nnome;preco\r\nCaneca;34,90\r\n");
  assert.deepEqual(erros, []);
  assert.equal(produtos[0].nome, "Caneca");
});

test("arquivo só com cabeçalho diz que está vazio", () => {
  assert.deepEqual(lerCsvProdutos("nome;preco\r\n\r\n\r\n").erros, ["Planilha vazia."]);
});
