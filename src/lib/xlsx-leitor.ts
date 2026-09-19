import { inflateRawSync } from "node:zlib";

/**
 * Ler .xlsx, o caminho de volta do `xlsx.ts`.
 *
 * O painel exportava .xlsx e só aceitava .csv de volta: quem baixava o
 * catálogo para corrigir preço no Excel tinha que lembrar de "Salvar como
 * CSV" — e, ao fazer isso, devolvia ao arquivo exatamente os defeitos que o
 * .xlsx existe para evitar (o GTIN de 13 dígitos virando 7,89123E+12, o SKU
 * "007" virando 7). O ciclo só fecha lendo o formato que a loja baixou.
 *
 * É leitura de zip e de XML, no servidor, porque é lá que existe `zlib`. Não
 * há cálculo de fórmula, data nem estilo: o que sobe daqui é texto de célula,
 * e quem decide o que cada coluna significa continua sendo
 * `produtosDeLinhas` (src/lib/planilha-produtos.ts).
 */

export class ErroPlanilha extends Error {}

/** Um arquivo dentro do zip. */
type Parte = { nome: string; dados: Buffer };

/**
 * Descompacta pelo diretório central, e não varrendo cabeçalhos locais: o
 * Excel grava tamanho zero no cabeçalho local e o valor real só depois dos
 * dados (bit 3, "data descriptor"). Quem varre do começo lê zero byte e
 * conclui que a planilha está vazia.
 */
function abrirZip(arquivo: Buffer): Map<string, Buffer> {
  const FIM = 0x06054b50;
  let fim = -1;
  // O fim do diretório central tem comentário opcional de até 64 KiB.
  for (let i = arquivo.length - 22; i >= 0 && i >= arquivo.length - 22 - 0xffff; i--) {
    if (arquivo.readUInt32LE(i) === FIM) { fim = i; break; }
  }
  if (fim < 0) throw new ErroPlanilha("O arquivo não é uma planilha .xlsx válida.");

  const total = arquivo.readUInt16LE(fim + 10);
  let p = arquivo.readUInt32LE(fim + 16);
  const partes: Parte[] = [];

  for (let i = 0; i < total; i++) {
    if (arquivo.readUInt32LE(p) !== 0x02014b50) throw new ErroPlanilha("Planilha corrompida: índice do arquivo não confere.");
    const metodo = arquivo.readUInt16LE(p + 10);
    const comprimido = arquivo.readUInt32LE(p + 20);
    const tamanhoNome = arquivo.readUInt16LE(p + 28);
    const tamanhoExtra = arquivo.readUInt16LE(p + 30);
    const tamanhoComentario = arquivo.readUInt16LE(p + 32);
    const local = arquivo.readUInt32LE(p + 42);
    const nome = arquivo.subarray(p + 46, p + 46 + tamanhoNome).toString("utf8");

    // O cabeçalho local repete o nome e o campo extra com tamanhos próprios:
    // é ele que diz onde os dados começam de verdade.
    const nomeLocal = arquivo.readUInt16LE(local + 26);
    const extraLocal = arquivo.readUInt16LE(local + 28);
    const inicio = local + 30 + nomeLocal + extraLocal;
    const bruto = arquivo.subarray(inicio, inicio + comprimido);

    if (metodo === 0) partes.push({ nome, dados: Buffer.from(bruto) });
    else if (metodo === 8) partes.push({ nome, dados: inflateRawSync(bruto) });
    // Outros métodos (bzip2, lzma) não aparecem em .xlsx de Excel, Google
    // Planilhas ou LibreOffice; ignorar é melhor que recusar o arquivo todo.

    p += 46 + tamanhoNome + tamanhoExtra + tamanhoComentario;
  }
  return new Map(partes.map((x) => [x.nome, x.dados]));
}

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

function texto(bruto: string): string {
  return bruto.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (inteiro, corpo: string) => {
    if (corpo.startsWith("#x") || corpo.startsWith("#X")) return String.fromCodePoint(Number.parseInt(corpo.slice(2), 16));
    if (corpo.startsWith("#")) return String.fromCodePoint(Number.parseInt(corpo.slice(1), 10));
    return ENTIDADES[corpo] ?? inteiro;
  });
}

/** "BC12" → 54. A letra é a coluna; sem isso, célula vazia no meio da linha
 *  empurra todo o resto uma casa e o preço cai na coluna da categoria. */
function indiceDaColuna(ref: string): number {
  let n = 0;
  for (const ch of ref) {
    const c = ch.toUpperCase().charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

/** Todo `<t>` de dentro de cada `<si>`: o Excel quebra uma célula em vários
 *  pedaços quando parte dela está em negrito. */
function lerTextosCompartilhados(xml: string): string[] {
  const textos: string[] = [];
  for (const si of xml.match(/<si\b[\s\S]*?<\/si>|<si\b[^>]*\/>/g) ?? []) {
    let junto = "";
    for (const t of si.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) ?? []) {
      junto += texto(t.replace(/^<t\b[^>]*>/, "").replace(/<\/t>$/, ""));
    }
    textos.push(junto);
  }
  return textos;
}

/** Caminho da primeira aba, pela ordem do próprio arquivo. */
function caminhoDaPrimeiraAba(partes: Map<string, Buffer>): string {
  const livro = partes.get("xl/workbook.xml")?.toString("utf8") ?? "";
  const rid = livro.match(/<sheet\b[^>]*r:id="([^"]+)"/)?.[1];
  const rels = partes.get("xl/_rels/workbook.xml.rels")?.toString("utf8") ?? "";
  if (rid) {
    const alvo = rels.match(new RegExp(`<Relationship\\b[^>]*Id="${rid}"[^>]*Target="([^"]+)"`))?.[1]
      ?? rels.match(new RegExp(`<Relationship\\b[^>]*Target="([^"]+)"[^>]*Id="${rid}"`))?.[1];
    if (alvo) return alvo.startsWith("/") ? alvo.slice(1) : `xl/${alvo.replace(/^\.\//, "")}`;
  }
  const primeira = [...partes.keys()].find((n) => /^xl\/worksheets\/.*\.xml$/.test(n));
  if (!primeira) throw new ErroPlanilha("A planilha não tem nenhuma aba legível.");
  return primeira;
}

/** Teto de linhas lidas. A importação grava no máximo 2.000 por vez; ler bem
 *  mais que isso serve para o painel conseguir dizer quantas vieram. */
const TETO_LINHAS = 20_000;

/**
 * .xlsx → matriz de texto, no formato que `produtosDeLinhas` espera.
 *
 * Só a primeira aba: planilha de fornecedor costuma trazer "Instruções" e
 * "Tabela" no mesmo arquivo, e adivinhar qual é o catálogo seria pior que
 * pedir que a primeira seja a certa.
 */
export function linhasDeXlsx(arquivo: Buffer): string[][] {
  const partes = abrirZip(arquivo);
  const compartilhados = lerTextosCompartilhados(partes.get("xl/sharedStrings.xml")?.toString("utf8") ?? "");
  const aba = partes.get(caminhoDaPrimeiraAba(partes));
  if (!aba) throw new ErroPlanilha("A planilha não tem nenhuma aba legível.");
  const xml = aba.toString("utf8");

  const linhas: string[][] = [];
  for (const linha of xml.match(/<row\b[\s\S]*?<\/row>|<row\b[^>]*\/>/g) ?? []) {
    if (linhas.length >= TETO_LINHAS) break;
    // A linha diz em que altura da planilha ela está. Quem apaga o conteúdo
    // de uma linha no Excel deixa o buraco no arquivo, e ignorar o `r="7"`
    // faria "Linha 7" virar "Linha 5" no aviso de erro — justamente o número
    // que o lojista usa para achar o problema.
    const altura = Number.parseInt(linha.match(/<row\b[^>]*\br="(\d+)"/)?.[1] ?? "0", 10);
    while (altura > 0 && linhas.length < altura - 1 && linhas.length < TETO_LINHAS) linhas.push([]);
    const celulas: string[] = [];
    for (const celula of linha.match(/<c\b[\s\S]*?<\/c>|<c\b[^>]*\/>/g) ?? []) {
      const ref = celula.match(/\br="([A-Z]+)\d+"/)?.[1];
      const tipo = celula.match(/\bt="([^"]+)"/)?.[1] ?? "n";
      const bruto = celula.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1] ?? "";

      let valor: string;
      if (tipo === "s") {
        valor = compartilhados[Number.parseInt(bruto, 10)] ?? "";
      } else if (tipo === "inlineStr") {
        valor = (celula.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) ?? [])
          .map((t) => texto(t.replace(/^<t\b[^>]*>/, "").replace(/<\/t>$/, "")))
          .join("");
      } else if (tipo === "b") {
        valor = bruto === "1" ? "sim" : "nao";
      } else {
        // `str` (resultado de fórmula) e número vêm crus no `<v>`.
        valor = texto(bruto);
      }

      const i = ref ? indiceDaColuna(ref) : celulas.length;
      while (celulas.length < i) celulas.push("");
      celulas[i] = valor;
    }
    linhas.push(celulas);
  }

  // Linha totalmente vazia no fim é comum em planilha mexida à mão.
  while (linhas.length && linhas[linhas.length - 1].every((c) => !c.trim())) linhas.pop();
  return linhas;
}
