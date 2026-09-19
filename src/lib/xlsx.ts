import { deflateRawSync } from "node:zlib";

/**
 * Planilha .xlsx, sem dependência.
 *
 * O CSV já abre no Excel (BOM e ponto e vírgula, ver `exportar.ts`), mas ele
 * não diz o que cada célula é, e o Excel decide sozinho: "007" vira 7, um GTIN
 * de 13 dígitos vira 7,89123E+12 e um SKU "12-3" vira data. Quem baixa o
 * catálogo, corrige o preço e reimporta leva esse estrago de volta para o
 * banco — que é justamente o caminho que a tela de Produtos oferece.
 *
 * No .xlsx a célula declara o tipo, e texto continua texto. O arquivo é um zip
 * de XML: cabem em pouco mais de cem linhas os cinco arquivos fixos do formato
 * e o cabeçalho do zip. É menos superfície do que uma biblioteca de planilha,
 * que traria leitura, fórmula e estilo que ninguém usa aqui.
 *
 * Um valor só vira número quando quem monta a linha manda um `number`: código,
 * telefone e CEP saem como texto de propósito.
 */

export type Celula = string | number | boolean | null | undefined;

/** Limite do formato: célula maior que isto o Excel recusa ao abrir. */
const MAX_CELULA = 32_767;

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[i] = c >>> 0;
  }
  return t;
})();

function crc32(dados: Buffer): number {
  let c = 0xffffffff;
  for (const byte of dados) c = TABELA_CRC[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/**
 * Zip mínimo (deflate cru), com data fixa: dois catálogos iguais geram dois
 * arquivos iguais, o que deixa o teste comparar bytes sem depender do relógio.
 */
function zipar(arquivos: Array<{ nome: string; dados: Buffer }>): Uint8Array<ArrayBuffer> {
  const DATA_FIXA = 0x0021; // 01/01/1980, a menor data que o formato aceita.
  const locais: Buffer[] = [];
  const central: Buffer[] = [];
  let deslocamento = 0;

  for (const arquivo of arquivos) {
    const nome = Buffer.from(arquivo.nome, "utf8");
    const comprimido = deflateRawSync(arquivo.dados, { level: 9 });
    const crc = crc32(arquivo.dados);

    const cabecalho = Buffer.alloc(30);
    cabecalho.writeUInt32LE(0x04034b50, 0);
    cabecalho.writeUInt16LE(20, 4); // versão necessária
    cabecalho.writeUInt16LE(0x0800, 6); // nomes em UTF-8
    cabecalho.writeUInt16LE(8, 8); // deflate
    cabecalho.writeUInt16LE(0, 10); // hora
    cabecalho.writeUInt16LE(DATA_FIXA, 12);
    cabecalho.writeUInt32LE(crc, 14);
    cabecalho.writeUInt32LE(comprimido.length, 18);
    cabecalho.writeUInt32LE(arquivo.dados.length, 22);
    cabecalho.writeUInt16LE(nome.length, 26);
    cabecalho.writeUInt16LE(0, 28); // sem campo extra
    locais.push(cabecalho, nome, comprimido);

    const entrada = Buffer.alloc(46);
    entrada.writeUInt32LE(0x02014b50, 0);
    entrada.writeUInt16LE(20, 4); // versão de quem gravou
    entrada.writeUInt16LE(20, 6);
    entrada.writeUInt16LE(0x0800, 8);
    entrada.writeUInt16LE(8, 10);
    entrada.writeUInt16LE(0, 12);
    entrada.writeUInt16LE(DATA_FIXA, 14);
    entrada.writeUInt32LE(crc, 16);
    entrada.writeUInt32LE(comprimido.length, 20);
    entrada.writeUInt32LE(arquivo.dados.length, 24);
    entrada.writeUInt16LE(nome.length, 28);
    entrada.writeUInt32LE(0, 30); // extra + comentário
    entrada.writeUInt16LE(0, 36); // disco
    entrada.writeUInt32LE(0, 38); // atributos
    entrada.writeUInt32LE(deslocamento, 42);
    central.push(entrada, nome);

    deslocamento += cabecalho.length + nome.length + comprimido.length;
  }

  const diretorio = Buffer.concat(central);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(arquivos.length, 8);
  fim.writeUInt16LE(arquivos.length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(deslocamento, 16);
  // `Uint8Array` e não `Buffer`: é o que o `Response` do Next aceita como
  // corpo sem conversão.
  return new Uint8Array(Buffer.concat([...locais, diretorio, fim]));
}

/** Escapa o texto e tira os caracteres de controle que o XML não aceita —
 *  descrição vinda de ERP costuma trazer um \u0000 no meio. */
function texto(valor: string): string {
  return valor
    .slice(0, MAX_CELULA)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** 0 → A, 26 → AA. */
export function letraDaColuna(indice: number): string {
  let n = indice + 1;
  let letra = "";
  while (n > 0) {
    const resto = (n - 1) % 26;
    letra = String.fromCharCode(65 + resto) + letra;
    n = Math.floor((n - resto) / 26);
  }
  return letra;
}

function celulaXml(ref: string, valor: Celula, cabecalho: boolean): string {
  const estilo = cabecalho ? ' s="1"' : "";
  if (valor === null || valor === undefined || valor === "") return "";
  if (typeof valor === "number") {
    if (!Number.isFinite(valor)) return "";
    return `<c r="${ref}"${estilo}><v>${valor}</v></c>`;
  }
  const conteudo = typeof valor === "boolean" ? (valor ? "sim" : "não") : String(valor);
  // `inlineStr` em vez da tabela de strings compartilhadas: gasta mais bytes
  // num catálogo grande, mas dispensa um sexto arquivo e um passe a mais.
  return `<c r="${ref}"${estilo} t="inlineStr"><is><t xml:space="preserve">${texto(conteudo)}</t></is></c>`;
}

/** Largura por coluna, medida no conteúdo — coluna de 8 caracteres com nome de
 *  produto dentro é planilha que chega ilegível. */
function colunasXml(linhas: Celula[][]): string {
  if (!linhas.length) return "";
  const larguras = linhas[0].map((_, coluna) => {
    const maior = linhas.reduce((max, linha) => Math.max(max, String(linha[coluna] ?? "").length), 0);
    return Math.min(60, Math.max(10, maior + 2));
  });
  return `<cols>${larguras
    .map((l, i) => `<col min="${i + 1}" max="${i + 1}" width="${l}" customWidth="1"/>`)
    .join("")}</cols>`;
}

const ABERTURA = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

/**
 * Uma aba, primeira linha congelada e com filtro — é assim que a planilha
 * chega útil: o lojista rola cinco mil linhas sem perder o cabeçalho.
 */
export function montarXlsx(linhas: Celula[][], opcoes: { aba?: string } = {}): Uint8Array<ArrayBuffer> {
  const aba = (opcoes.aba ?? "Dados").replace(/[[\]:*?/\\]/g, " ").slice(0, 31) || "Dados";
  const colunas = linhas[0]?.length ?? 1;
  const intervalo = `A1:${letraDaColuna(Math.max(0, colunas - 1))}${Math.max(1, linhas.length)}`;

  const corpo = linhas
    .map((linha, i) => {
      const celulas = linha.map((valor, j) => celulaXml(`${letraDaColuna(j)}${i + 1}`, valor, i === 0)).join("");
      return `<row r="${i + 1}">${celulas}</row>`;
    })
    .join("");

  const planilha =
    `${ABERTURA}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<dimension ref="${intervalo}"/>` +
    '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>' +
    '<sheetFormatPr defaultRowHeight="15"/>' +
    colunasXml(linhas) +
    `<sheetData>${corpo}</sheetData>` +
    (linhas.length > 1 ? `<autoFilter ref="${intervalo}"/>` : "") +
    "</worksheet>";

  const estilos =
    `${ABERTURA}<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
    // Os dois preenchimentos são exigência do formato: o Excel recusa o arquivo
    // se `none` e `gray125` não forem os dois primeiros.
    '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
    '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
    '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
    '<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
    '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>' +
    // O estilo "Normal" é o padrão que todo leitor espera achar; sem ele o
    // openpyxl avisa e o Excel reescreve o arquivo ao abrir.
    '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
    "</styleSheet>";

  return zipar([
    {
      nome: "[Content_Types].xml",
      dados: Buffer.from(
        `${ABERTURA}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
          "</Types>",
        "utf8",
      ),
    },
    {
      nome: "_rels/.rels",
      dados: Buffer.from(
        `${ABERTURA}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          "</Relationships>",
        "utf8",
      ),
    },
    {
      nome: "xl/workbook.xml",
      dados: Buffer.from(
        `${ABERTURA}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          `<sheets><sheet name="${texto(aba)}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
        "utf8",
      ),
    },
    {
      nome: "xl/_rels/workbook.xml.rels",
      dados: Buffer.from(
        `${ABERTURA}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
          '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
          "</Relationships>",
        "utf8",
      ),
    },
    { nome: "xl/styles.xml", dados: Buffer.from(estilos, "utf8") },
    { nome: "xl/worksheets/sheet1.xml", dados: Buffer.from(planilha, "utf8") },
  ]);
}
