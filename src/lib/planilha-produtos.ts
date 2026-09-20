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
  "imagem_origem",
  "imagem_familia",
  "confirmar_imagem_exata",
  "correspondencia_imagem",
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

/** Lê registros CSV completos, inclusive quebras de linha dentro de aspas. */
function lerRegistrosCsv(texto: string): { registros: string[][]; erro?: string } {
  const conteudo = texto.replace(/^\uFEFF/, "");
  let separadores = { virgula: 0, pontoVirgula: 0 };
  let entreAspas = false;
  for (let i = 0; i < conteudo.length; i++) {
    const caractere = conteudo[i];
    if (caractere === '"') {
      if (entreAspas && conteudo[i + 1] === '"') i++;
      else entreAspas = !entreAspas;
    } else if (!entreAspas && (caractere === "\n" || caractere === "\r")) break;
    else if (!entreAspas && caractere === ",") separadores.virgula++;
    else if (!entreAspas && caractere === ";") separadores.pontoVirgula++;
  }
  const separador = separadores.pontoVirgula > separadores.virgula ? ";" : ",";
  const registros: string[][] = [];
  let registro: string[] = [];
  let campo = "";
  entreAspas = false;

  const concluirCampo = () => { registro.push(campo.trim()); campo = ""; };
  const concluirRegistro = () => {
    concluirCampo();
    if (registro.some((valor) => valor.length > 0)) registros.push(registro);
    registro = [];
  };

  for (let i = 0; i < conteudo.length; i++) {
    const caractere = conteudo[i];
    if (caractere === '"') {
      if (entreAspas && conteudo[i + 1] === '"') {
        campo += '"';
        i++;
      } else if (entreAspas) entreAspas = false;
      else if (campo.length === 0) entreAspas = true;
      else campo += caractere;
    } else if (entreAspas && (caractere === "\n" || caractere === "\r")) {
      campo += "\n";
      if (caractere === "\r" && conteudo[i + 1] === "\n") i++;
    } else if (!entreAspas && caractere === separador) concluirCampo();
    else if (!entreAspas && (caractere === "\n" || caractere === "\r")) {
      concluirRegistro();
      if (caractere === "\r" && conteudo[i + 1] === "\n") i++;
    } else campo += caractere;
  }

  if (entreAspas) return { registros: [], erro: "Planilha inválida: há um campo entre aspas sem fechamento." };
  if (campo.length > 0 || registro.length > 0) concluirRegistro();
  return { registros };
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
  const { registros, erro } = lerRegistrosCsv(texto);
  if (erro) return { produtos: [] as Array<Record<string, unknown>>, erros: [erro] };
  if (registros.length < 2) return { produtos: [] as Array<Record<string, unknown>>, erros: ["Planilha vazia."] };
  // O BOM que o próprio painel grava (e o Excel exige) vira parte do primeiro
  // cabeçalho se não sair aqui: sem isso, o arquivo que a loja acabou de
  // baixar volta sem a coluna `nome`.
  const cab = registros[0].map(normalizarCabecalho);
  const idx = (n: string) => cab.indexOf(n);
  const centavos = (v: string) => Math.round(Number.parseFloat(v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3})/g, "").replace(",", ".")) * 100);

  const produtos: Array<Record<string, unknown>> = [];
  const erros: string[] = [];
  registros.slice(1).forEach((c, i) => {
    const pega = (n: string) => (idx(n) >= 0 ? c[idx(n)] || undefined : undefined);
    const nome = c[idx("nome")]?.trim() ?? "";
    const sku = pega("sku");
    const slug = pega("slug");
    const brutoPreco = idx("preco") >= 0 ? c[idx("preco")]?.trim() ?? "" : "";
    const preco = brutoPreco ? centavos(brutoPreco) : undefined;
    if (!nome && !sku && !slug) {
      erros.push(`Linha ${i + 2}: informe SKU, slug ou nome para localizar o produto.`);
      return;
    }
    if (brutoPreco && !Number.isFinite(preco)) {
      erros.push(`Linha ${i + 2}: preço inválido.`);
      return;
    }
    const decimal = (n: string) => {
      const bruto = pega(n);
      if (bruto === undefined) return undefined;
      const valor = Number.parseFloat(bruto.replace(",", "."));
      return Number.isFinite(valor) && valor > 0 ? valor : undefined;
    };
    const precoDe = pega("preco_de") ? centavos(pega("preco_de")!) : undefined;
    const estoque = pega("estoque") ? Number.parseInt(pega("estoque")!.replace(/\D/g, ""), 10) : undefined;
    const ativo = pega("ativo");
    const identificadoresEstado = pega("identificadores_estado")?.toLowerCase();
    const estadoValido = identificadoresEstado === "desconhecido" || identificadoresEstado === "informado" || identificadoresEstado === "sem_identificador";
    if (identificadoresEstado && !estadoValido) {
      erros.push(`Linha ${i + 2}: identificadores_estado deve ser desconhecido, informado ou sem_identificador.`);
      return;
    }
    // `destaque` só é escrito quando a coluna existe: antes, toda planilha sem
    // ela tirava a estrela de todo produto importado, sem aviso nenhum.
    const destaque = pega("destaque");
    const correspondenciaImagem = pega("correspondencia_imagem")?.toLowerCase();
    if (correspondenciaImagem && !["nao_confirmada", "confirmada", "rejeitada"].includes(correspondenciaImagem)) {
      erros.push(`Linha ${i + 2}: correspondencia_imagem deve ser nao_confirmada, confirmada ou rejeitada.`);
      return;
    }
    const googleProductCategory = pega("google_product_category");
    const imagemOrigem = pega("imagem_origem")?.toLowerCase();
    const origemValida = imagemOrigem === "propria" || imagemOrigem === "representativa" || imagemOrigem === "ilustracao";
    if (imagemOrigem && !origemValida) {
      erros.push(`Linha ${i + 2}: imagem_origem deve ser propria, representativa ou ilustracao.`);
      return;
    }
    const confirmarImagemExata = pega("confirmar_imagem_exata")?.toLowerCase();
    if (confirmarImagemExata && !SIM.test(confirmarImagemExata) && !NAO.test(confirmarImagemExata)) {
      erros.push(`Linha ${i + 2}: confirmar_imagem_exata deve ser sim ou nao.`);
      return;
    }
    produtos.push({
      ...(nome ? { nome } : {}),
      ...(preco !== undefined ? { precoCentavos: preco } : {}),
      ...(slug ? { slug } : {}),
      ...(precoDe !== undefined && Number.isFinite(precoDe) ? { precoDeCentavos: precoDe } : {}),
      categoria: pega("categoria"),
      ...(googleProductCategory !== undefined ? { googleProductCategory: googleProductCategory.toLowerCase() === "auto" ? null : googleProductCategory } : {}),
      marca: pega("marca"),
      ...(sku ? { sku } : {}),
      // O código de barras costuma vir com pontuação ou como texto do Excel;
      // só os dígitos interessam, e vazio não vira string vazia no banco.
      gtin: pega("gtin")?.replace(/\D/g, "") || undefined,
      mpn: pega("mpn")?.trim() || undefined,
      ...(estadoValido ? { identificadoresEstado } : {}),
      descricaoCurta: pega("descricao_curta"),
      descricao: pega("descricao"),
      imagens: pega("imagem") ? [pega("imagem")!] : undefined,
      ...(origemValida ? { imagemOrigem } : {}),
      ...(idx("imagem_familia") >= 0 ? { imagemFamilia: c[idx("imagem_familia")] || null } : {}),
      ...(confirmarImagemExata && SIM.test(confirmarImagemExata) ? { confirmarImagemExata: true } : {}),
      ...(correspondenciaImagem ? { correspondenciaImagem } : {}),
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
