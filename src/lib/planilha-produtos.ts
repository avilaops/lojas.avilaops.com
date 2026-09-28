/**
 * A planilha do catálogo, nos dois sentidos.
 *
 * Exportar e importar eram dois formatos diferentes escritos em dois lugares
 * diferentes — na prática, a exportação nem existia: o lojista que subiu 5.591
 * itens por planilha não tinha como baixar o que subiu, e para corrigir preço
 * em lote precisava do arquivo do fornecedor de volta. Aqui a lista de colunas
 * é uma só, e é o que garante a volta: baixa, corrige no Excel, reimporta.
 *
 * `imagem` preserva compatibilidade com planilhas antigas. `imagens` leva a
 * galeria completa, separada por |, e `atributos_json` preserva a ficha técnica.
 *
 * Quem lê o arquivo (`lerCsvProdutos` aqui, `linhasDeXlsx` no servidor) só
 * entrega uma matriz de texto; quem decide o que cada coluna significa é
 * `produtosDeLinhas`, uma vez só. Formato novo não pode reabrir a discussão
 * de o que é "destaque".
 */

/**
 * Quanto cabe num arquivo, por tipo.
 *
 * O teto existe para o servidor não montar uma planilha de dezenas de MB na
 * memória. Ele fica aqui, e não na exportação, porque a tela precisa dizer
 * que o arquivo veio cortado. Exportação que corta em silêncio é pior que
 * exportação que não existe: o lojista corrige o que baixou, reenvia, e
 * conclui que o resto do catálogo sumiu.
 */
export const TETO_EXPORTACAO = { produtos: 20_000, pedidos: 5_000 } as const;

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
  "imagens",
  "atributos_json",
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

/**
 * Lê registros CSV completos, inclusive quebras de linha dentro de aspas.
 *
 * Linha em branco fica na matriz, vazia. Descartá-la aqui fazia "Linha 312"
 * apontar para outra linha do Excel, e quanto mais buracos no arquivo, maior
 * o deslocamento. Quem ignora linha vazia é `produtosDeLinhas`, que sabe a
 * posição real.
 */
function lerRegistrosCsv(texto: string): { registros: string[][]; erro?: string } {
  const conteudo = texto.replace(/^\uFEFF/, "");
  const separadores = { virgula: 0, pontoVirgula: 0 };
  let entreAspas = false;
  // O separador sai da primeira linha escrita: arquivo de fornecedor que
  // começa com linha em branco não pode cair no padrão vírgula.
  let escrito = false;
  for (let i = 0; i < conteudo.length; i++) {
    const caractere = conteudo[i];
    if (caractere === '"') {
      escrito = true;
      if (entreAspas && conteudo[i + 1] === '"') i++;
      else entreAspas = !entreAspas;
    } else if (!entreAspas && (caractere === "\n" || caractere === "\r")) {
      if (escrito) break;
    } else if (!entreAspas && caractere === ",") { escrito = true; separadores.virgula++; }
    else if (!entreAspas && caractere === ";") { escrito = true; separadores.pontoVirgula++; }
    else if (caractere.trim()) escrito = true;
  }
  const separador = separadores.pontoVirgula > separadores.virgula ? ";" : ",";
  const registros: string[][] = [];
  let registro: string[] = [];
  let campo = "";
  entreAspas = false;

  const concluirCampo = () => { registro.push(campo.trim()); campo = ""; };
  const concluirRegistro = () => {
    concluirCampo();
    registros.push(registro);
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
 * Uma linha da planilha, já dividida em células de texto.
 *
 * Célula vazia é string vazia e coluna ausente é `undefined`: a diferença
 * decide se o produto é sobrescrito ou fica como está.
 */
export type LinhaDePlanilha = string[];

/**
 * "R$ 1.234,56", "1234.56" ou "79.90000000000001" → centavos.
 *
 * A vírgula é quem manda: quando existe, ela é o decimal e o ponto é milhar,
 * que é como o Excel em português grava. Sem vírgula, o ponto é o decimal e
 * não se mexe nele.
 *
 * A regra antiga apagava todo ponto seguido de três dígitos, para dar conta
 * de "1.234,56". Só que `79.90000000000001`, que é como uma planilha guarda
 * 79,90, virava 7.990.000.000.000.001 centavos, e o banco recusava o lote
 * inteiro com erro de conversão.
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
 * Coluna que não existe no arquivo não é mexida no produto: planilha de
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
    // Linha vazia não é erro: é o enter que sobrou no meio ou no fim.
    if (!c.some((v) => v.trim())) return;
    const pega = (n: string) => (idx(n) >= 0 ? c[idx(n)]?.trim() || undefined : undefined);
    const nome = pega("nome") ?? "";
    const sku = pega("sku");
    const slug = pega("slug");
    const brutoPreco = pega("preco") ?? "";
    const preco = brutoPreco ? centavos(brutoPreco) : undefined;
    if (!nome && !sku && !slug) {
      erros.push(`Linha ${linha}: informe SKU, slug ou nome para localizar o produto.`);
      return;
    }
    if (preco !== undefined && !Number.isFinite(preco)) {
      erros.push(`Linha ${linha}: preço inválido.`);
      return;
    }
    if (preco !== undefined && !precoCabe(preco)) {
      erros.push(`Linha ${linha}: preço fora do limite (${LIMITE_EM_REAIS}).`);
      return;
    }
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
    const identificadoresEstado = pega("identificadores_estado")?.toLowerCase();
    const estadoValido = identificadoresEstado === "desconhecido" || identificadoresEstado === "informado" || identificadoresEstado === "sem_identificador";
    if (identificadoresEstado && !estadoValido) {
      erros.push(`Linha ${linha}: identificadores_estado deve ser desconhecido, informado ou sem_identificador.`);
      return;
    }
    // `destaque` só é escrito quando a coluna existe: antes, toda planilha sem
    // ela tirava a estrela de todo produto importado, sem aviso nenhum.
    const destaque = pega("destaque");
    const googleProductCategory = pega("google_product_category");
    const imagensBrutas = pega("imagens");
    const imagens = imagensBrutas
      ? imagensBrutas.split("|").map((url) => url.trim()).filter(Boolean)
      : pega("imagem") ? [pega("imagem")!] : undefined;
    if (imagens && imagens.length > 10) {
      erros.push(`Linha ${linha}: informe no máximo 10 imagens, separadas por |.`);
      return;
    }
    const atributosBrutos = pega("atributos_json");
    let atributos: Record<string, unknown> | undefined;
    if (atributosBrutos) {
      try {
        const valor: unknown = JSON.parse(atributosBrutos);
        if (!valor || typeof valor !== "object" || Array.isArray(valor)) throw new Error("JSON precisa ser um objeto.");
        atributos = valor as Record<string, unknown>;
      } catch {
        erros.push(`Linha ${linha}: atributos_json precisa conter um objeto JSON válido.`);
        return;
      }
    }
    const imagemOrigem = pega("imagem_origem")?.toLowerCase();
    const origemValida = imagemOrigem === "propria" || imagemOrigem === "representativa" || imagemOrigem === "ilustracao";
    if (imagemOrigem && !origemValida) {
      erros.push(`Linha ${linha}: imagem_origem deve ser propria, representativa ou ilustracao.`);
      return;
    }
    const confirmarImagemExata = pega("confirmar_imagem_exata")?.toLowerCase();
    if (confirmarImagemExata && !SIM.test(confirmarImagemExata) && !NAO.test(confirmarImagemExata)) {
      erros.push(`Linha ${linha}: confirmar_imagem_exata deve ser sim ou nao.`);
      return;
    }
    const correspondenciaImagem = pega("correspondencia_imagem")?.toLowerCase();
    if (correspondenciaImagem && !["nao_confirmada", "confirmada", "rejeitada"].includes(correspondenciaImagem)) {
      erros.push(`Linha ${linha}: correspondencia_imagem deve ser nao_confirmada, confirmada ou rejeitada.`);
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
      ...(imagens ? { imagens: Array.from(new Set(imagens)) } : {}),
      ...(atributos ? { atributos } : {}),
      ...(origemValida ? { imagemOrigem } : {}),
      ...(idx("imagem_familia") >= 0 ? { imagemFamilia: c[idx("imagem_familia")]?.trim() || null } : {}),
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
  // Cabeçalho sozinho, ou só linhas em branco depois dele.
  if (!produtos.length && !erros.length) erros.push("Planilha vazia.");
  return { produtos, erros };
}

/** CSV → produtos. Também roda no navegador (cadastro da loja nova). */
export function lerCsvProdutos(texto: string) {
  const { registros, erro } = lerRegistrosCsv(texto);
  if (erro) return { produtos: [] as Array<Record<string, unknown>>, erros: [erro] };
  return produtosDeLinhas(registros);
}
