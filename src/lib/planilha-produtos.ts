/**
 * A planilha do catálogo, nos dois sentidos.
 *
 * Exportar e importar eram dois formatos diferentes escritos em dois lugares
 * diferentes — na prática, a exportação nem existia: o lojista que subiu 5.591
 * itens por planilha não tinha como baixar o que subiu, e para corrigir preço
 * em lote precisava do arquivo do fornecedor de volta. Aqui a lista de colunas
 * é uma só, e é o que garante a volta: baixa, corrige no Excel, reimporta.
 *
 * `imagem` leva só a primeira foto de propósito: é a que a vitrine usa como
 * capa, e uma coluna por foto quebraria a planilha em quem tem oito.
 *
 * Quem lê o arquivo — `lerCsvProdutos` aqui, `lerXlsxProdutos` no servidor —
 * só entrega uma matriz de texto; quem decide o que cada coluna significa é
 * `produtosDeLinhas`, uma vez só. Formato novo não pode reabrir a discussão
 * de o que é "destaque".
 */

/**
 * Quanto cabe num arquivo, por tipo.
 *
 * O teto existe para o servidor não montar uma planilha de dezenas de MB na
 * memória. Ele fica aqui, e não na exportação, porque a tela precisa dizer
 * que o arquivo veio cortado — exportação que corta em silêncio é pior que
 * exportação que não existe: o lojista corrige o que baixou, reenvia, e
 * conclui que o resto do catálogo sumiu.
 */
export const TETO_EXPORTACAO = { produtos: 20_000, pedidos: 5_000 } as const;

/** Cabeçalho, na ordem em que sai — e a mesma do `modelo-catalogo.csv`. */
export const COLUNAS_PRODUTO = [
  "nome",
  "preco",
  "categoria",
  "marca",
  "sku",
  "gtin",
  "preco_de",
  "descricao_curta",
  "descricao",
  "imagem",
  "destaque",
  "peso_kg",
  "altura_cm",
  "largura_cm",
  "comprimento_cm",
  "estoque",
  "ativo",
] as const;

/** Cabeçalho sem acento, minúsculo e com `_` no lugar do resto: é assim que a
 *  coluna "Preço de" da planilha do fornecedor encontra `preco_de`. */
export function normalizarCabecalho(nome: string): string {
  return nome.normalize("NFD").replace(/\p{M}+/gu, "").toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

const SIM = /^(1|sim|s|true|x|ativo)$/i;
const NAO = /^(0|nao|n|false|inativo)$/i;

/**
 * Uma linha da planilha, já dividida em células de texto.
 *
 * Célula vazia é string vazia e coluna ausente é `undefined`: a diferença
 * decide se o produto é sobrescrito ou fica como está.
 */
export type LinhaDePlanilha = string[];

/**
 * "R$ 1.234,56", "1234.56" ou "79.90000000000001" → centavos.
 *
 * A vírgula é quem manda: quando existe, ela é o decimal e o ponto é milhar —
 * é assim que o Excel em português grava. Sem vírgula, o ponto é o decimal e
 * não se mexe nele.
 *
 * A regra antiga apagava todo ponto seguido de três dígitos, para dar conta
 * de "1.234,56". Só que `79.90000000000001` — que é como uma planilha guarda
 * 79,90 — virava 7.990.000.000.000.001 centavos, e o banco recusava o lote
 * inteiro com erro de conversão. Achado reimportando um .xlsx exportado pelo
 * próprio painel.
 */
function centavos(v: string): number {
  const limpo = v.replace(/[^\d,.-]/g, "");
  const decimal = limpo.includes(",") ? limpo.replace(/\./g, "").replace(",", ".") : limpo;
  return Math.round(Number.parseFloat(decimal) * 100);
}

/** Teto de um inteiro no Postgres. Acima dele a gravação falha no driver e o
 *  lote inteiro cai por causa de uma célula. */
const TETO_INT = 2_147_483_647;
const LIMITE_EM_REAIS = "máximo R$ 21.474.836,47";
const precoCabe = (valor: number) => valor >= 0 && valor <= TETO_INT;

/**
 * Matriz (cabeçalho + linhas) → produtos prontos para a importação.
 *
 * Cabeçalhos aceitos em qualquer ordem, com ou sem acento: ver
 * `COLUNAS_PRODUTO`. Preço em reais ("59,90" ou "59.90") vira centavos.
 * Coluna que não existe no arquivo não é mexida no produto — planilha de
 * fornecedor que só traz preço não pode apagar foto, medida nem estoque.
 */
export function produtosDeLinhas(linhas: LinhaDePlanilha[]) {
  const produtos: Array<Record<string, unknown>> = [];
  const erros: string[] = [];
  // Planilha de fornecedor costuma começar com uma linha em branco. O
  // cabeçalho é a primeira linha com alguma coisa escrita, e a posição dela
  // fica guardada para o número da linha continuar sendo o do Excel.
  const cabecalho = linhas.findIndex((l) => l.some((c) => c.trim()));
  if (cabecalho < 0 || linhas.length - cabecalho < 2) return { produtos, erros: ["Planilha vazia."] };

  // O BOM que o próprio painel grava (e o Excel exige) vira parte do primeiro
  // cabeçalho se não sair aqui: sem isso, o arquivo que a loja acabou de
  // baixar volta sem a coluna `nome`.
  const cab = linhas[cabecalho].map((c, i) => normalizarCabecalho(i === 0 ? c.replace(/^﻿/, "") : c));
  const idx = (n: string) => cab.indexOf(n);

  linhas.slice(cabecalho + 1).forEach((c, i) => {
    // `Linha N` é a linha do Excel: é por ela que o lojista acha o problema
    // num arquivo de cinco mil itens.
    const linha = cabecalho + i + 2;
    // Linha vazia não é erro — é o enter que sobrou no meio ou no fim.
    if (!c.some((v) => v.trim())) return;
    const nome = (c[idx("nome")] ?? "").trim();
    const preco = centavos(c[idx("preco")] ?? "");
    if (!nome || !Number.isFinite(preco)) {
      erros.push(`Linha ${linha}: nome ou preço ausente.`);
      return;
    }
    if (!precoCabe(preco)) {
      erros.push(`Linha ${linha}: preço fora do limite (${LIMITE_EM_REAIS}).`);
      return;
    }
    const pega = (n: string) => (idx(n) >= 0 ? c[idx(n)]?.trim() || undefined : undefined);
    const decimal = (n: string) => {
      const bruto = pega(n);
      if (bruto === undefined) return undefined;
      const valor = Number.parseFloat(bruto.replace(",", "."));
      return Number.isFinite(valor) && valor > 0 ? valor : undefined;
    };
    const precoDeBruto = pega("preco_de") ? centavos(pega("preco_de")!) : undefined;
    // Preço "de" torto não derruba a linha: o produto entra sem o riscado.
    const precoDe = precoDeBruto !== undefined && precoCabe(precoDeBruto) ? precoDeBruto : undefined;
    const estoqueBruto = pega("estoque") ? Number.parseInt(pega("estoque")!.replace(/\D/g, ""), 10) : undefined;
    const estoque = estoqueBruto !== undefined && Number.isFinite(estoqueBruto) && estoqueBruto <= TETO_INT ? estoqueBruto : undefined;
    const ativo = pega("ativo");
    // `destaque` só é escrito quando a coluna existe: antes, toda planilha sem
    // ela tirava a estrela de todo produto importado, sem aviso nenhum.
    const destaque = pega("destaque");
    produtos.push({
      nome,
      precoCentavos: preco,
      ...(precoDe !== undefined && Number.isFinite(precoDe) ? { precoDeCentavos: precoDe } : {}),
      categoria: pega("categoria"),
      marca: pega("marca"),
      sku: pega("sku"),
      // O código de barras costuma vir com pontuação ou como texto do Excel;
      // só os dígitos interessam, e vazio não vira string vazia no banco.
      gtin: pega("gtin")?.replace(/\D/g, "") || undefined,
      descricaoCurta: pega("descricao_curta"),
      descricao: pega("descricao"),
      imagens: pega("imagem") ? [pega("imagem")!] : undefined,
      ...(idx("destaque") >= 0 ? { destaque: SIM.test(destaque ?? "") } : {}),
      ...(ativo !== undefined && (SIM.test(ativo) || NAO.test(ativo)) ? { ativo: SIM.test(ativo) } : {}),
      ...(estoque !== undefined && Number.isFinite(estoque) ? { estoque } : {}),
      // Medida em branco continua em branco: é a diferença entre "ainda não
      // medi" e "mede zero", e o frete cobra a caixa padrão da loja enquanto
      // ela faltar.
      ...(decimal("peso_kg") ? { pesoKg: decimal("peso_kg") } : {}),
      ...(decimal("altura_cm") ? { alturaCm: decimal("altura_cm") } : {}),
      ...(decimal("largura_cm") ? { larguraCm: decimal("largura_cm") } : {}),
      ...(decimal("comprimento_cm") ? { comprimentoCm: decimal("comprimento_cm") } : {}),
    });
  });
  // Cabeçalho sozinho, ou só linhas em branco depois dele.
  if (!produtos.length && !erros.length) erros.push("Planilha vazia.");
  return { produtos, erros };
}

/**
 * CSV → matriz. Separador é o do cabeçalho: o Excel em português grava com
 * ponto e vírgula, o Google Planilhas com vírgula.
 *
 * Linha em branco fica na matriz, vazia. Ela era descartada aqui, e com isso
 * "Linha 312: nome ou preço ausente" apontava para a linha errada no Excel —
 * quanto mais buracos no arquivo, maior o deslocamento. Quem ignora linha
 * vazia é `produtosDeLinhas`, que sabe a posição real.
 */
export function linhasDeCsv(texto: string): LinhaDePlanilha[] {
  const linhas = texto.replace(/\r/g, "").split("\n");
  // A última quebra de linha do arquivo não é uma linha.
  if (linhas.length && !linhas[linhas.length - 1].trim()) linhas.pop();
  if (!linhas.length) return [];
  const sep = (linhas.find((l) => l.trim()) ?? "").includes(";") ? ";" : ",";
  return linhas.map((l) => {
    const out: string[] = [];
    let atual = "";
    let aspas = false;
    for (const ch of l) {
      if (ch === '"') aspas = !aspas;
      else if (ch === sep && !aspas) {
        out.push(atual);
        atual = "";
      } else atual += ch;
    }
    out.push(atual);
    return out.map((c) => c.trim());
  });
}

/** CSV → produtos. */
export function lerCsvProdutos(texto: string) {
  return produtosDeLinhas(linhasDeCsv(texto));
}
