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
 */

/** Cabeçalho, na ordem em que sai — e a mesma do `modelo-catalogo.csv`. */
export const COLUNAS_PRODUTO = [
  "nome",
  "preco",
  "categoria",
  "google_product_category",
  "marca",
  "sku",
  "gtin",
  "mpn",
  "identificadores_estado",
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
 * CSV → produtos. Cabeçalhos aceitos (qualquer ordem, com ou sem acento):
 * ver `COLUNAS_PRODUTO`. Preço em reais ("59,90" ou "59.90") vira centavos.
 * Coluna que não existe no arquivo não é mexida no produto — planilha de
 * fornecedor que só traz preço não pode apagar foto, medida nem estoque.
 */
export function lerCsvProdutos(texto: string) {
  const linhas = texto.replace(/\r/g, "").split("\n").filter((l) => l.trim());
  if (linhas.length < 2) return { produtos: [] as Array<Record<string, unknown>>, erros: ["Planilha vazia."] };
  const sep = linhas[0].includes(";") ? ";" : ",";
  const dividir = (l: string) => {
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
  };
  // O BOM que o próprio painel grava (e o Excel exige) vira parte do primeiro
  // cabeçalho se não sair aqui: sem isso, o arquivo que a loja acabou de
  // baixar volta sem a coluna `nome`.
  const cab = dividir(linhas[0].replace(/^﻿/, "")).map(normalizarCabecalho);
  const idx = (n: string) => cab.indexOf(n);
  const centavos = (v: string) => Math.round(Number.parseFloat(v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".")) * 100);

  const produtos: Array<Record<string, unknown>> = [];
  const erros: string[] = [];
  linhas.slice(1).forEach((l, i) => {
    const c = dividir(l);
    const nome = c[idx("nome")] ?? "";
    const preco = centavos(c[idx("preco")] ?? "");
    if (!nome || !Number.isFinite(preco)) {
      erros.push(`Linha ${i + 2}: nome ou preço ausente.`);
      return;
    }
    const pega = (n: string) => (idx(n) >= 0 ? c[idx(n)] || undefined : undefined);
    const decimal = (n: string) => {
      const bruto = pega(n);
      if (bruto === undefined) return undefined;
      const valor = Number.parseFloat(bruto.replace(",", "."));
      return Number.isFinite(valor) && valor > 0 ? valor : undefined;
    };
    const precoDe = pega("preco_de") ? centavos(pega("preco_de")!) : undefined;
    const estoque = pega("estoque") ? Number.parseInt(pega("estoque")!.replace(/\D/g, ""), 10) : undefined;
    const ativo = pega("ativo");
    const googleProductCategory = pega("google_product_category");
    const identificadoresEstado = pega("identificadores_estado")?.toLowerCase();
    const estadoValido = identificadoresEstado === "desconhecido" || identificadoresEstado === "informado" || identificadoresEstado === "sem_identificador";
    if (identificadoresEstado && !estadoValido) erros.push(`Linha ${i + 2}: identificadores_estado deve ser desconhecido, informado ou sem_identificador.`);
    // `destaque` só é escrito quando a coluna existe: antes, toda planilha sem
    // ela tirava a estrela de todo produto importado, sem aviso nenhum.
    const destaque = pega("destaque");
    produtos.push({
      nome,
      precoCentavos: preco,
      ...(precoDe !== undefined && Number.isFinite(precoDe) ? { precoDeCentavos: precoDe } : {}),
      categoria: pega("categoria"),
      ...(googleProductCategory !== undefined ? { googleProductCategory: googleProductCategory.toLowerCase() === "auto" ? null : googleProductCategory } : {}),
      marca: pega("marca"),
      sku: pega("sku"),
      // O código de barras costuma vir com pontuação ou como texto do Excel;
      // só os dígitos interessam, e vazio não vira string vazia no banco.
      gtin: pega("gtin")?.replace(/\D/g, "") || undefined,
      mpn: pega("mpn")?.trim() || undefined,
      ...(estadoValido ? { identificadoresEstado } : {}),
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
  return { produtos, erros };
}
