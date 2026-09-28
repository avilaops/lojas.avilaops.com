import { medidaValida } from "./catalogo";

/**
 * A ficha técnica de um produto, na língua de quem compra e de quem indexa.
 *
 * `Produto.atributos` é JSON livre e chega do ERP do lojista com o que o ERP
 * tinha: `grupoLegado`, `ncm`, `unidade`, além das medidas. A tela mostrava
 * tudo cru ("Diametro interno mm 6", "Grupo legado Diversos"), e a mesma
 * medida que decide a compra saía sem unidade formatada e com a chave do
 * banco como rótulo. Para um crawler, "Altura mm 114" não é "altura de
 * 114 mm".
 *
 * Aqui mora a regra, uma vez, para a ficha visível e o JSON-LD dizerem a
 * mesma coisa:
 *
 *   - medida (`*Mm`) vira "Diâmetro interno · 101,6 mm", só se for válida
 *     (ver `medidaValida`); inválida não aparece, porque errada é pior que
 *     ausente;
 *   - chave interna do ERP (`grupoLegado`, e qualquer `_privada`) não sai;
 *   - o resto ganha rótulo traduzido quando é conhecido, e a regra geral de
 *     camelCase → texto quando não é.
 */

export type LinhaDaFicha = {
  chave: string;
  rotulo: string;
  /** O que a tela mostra ("101,6 mm"). */
  valor: string;
  /** Só para medida: o número e a unidade, para dado estruturado. */
  numero?: number;
  unidade?: "mm";
};

const MEDIDAS: Record<string, string> = {
  diametroInternoMm: "Diâmetro interno",
  diametroInternoRolamentoMm: "Diâmetro interno do rolamento",
  diametroExternoMm: "Diâmetro externo",
  diametroExternoPorcaMm: "Diâmetro externo da porca",
  medidaEixoMm: "Medida do eixo",
  alturaMm: "Altura",
  larguraMm: "Largura",
  comprimentoMm: "Comprimento",
  espessuraMm: "Espessura",
  secaoMm: "Seção do cordão",
  furoMm: "Furo",
};

/**
 * Chaves que são do ERP, não do produto. GTIN/EAN têm campo próprio e saem
 * como identificador do produto; repetidos na ficha, viravam uma linha
 * "Gtin 7898…" no meio das características.
 */
const INTERNAS = new Set(["grupoLegado", "gtin", "ean"]);

const ROTULOS: Record<string, string> = {
  ncm: "NCM",
  unidade: "Unidade de venda",
  unidadeVenda: "Unidade de venda",
  referencia: "Referência",
  subtipo: "Subtipo",
  vedacao: "Vedação",
  folga: "Folga",
  linha: "Linha",
  material: "Material",
  tipo: "Tipo",
  volume: "Volume",
  volumeMl: "Volume (ml)",
  volumeTotal: "Volume total",
  funcao: "Função",
  aplicacao: "Aplicação",
  aplicacaoVeicular: "Aplicação veicular",
  aplicacaoDomestica: "Aplicação doméstica",
  aplicacaoDoProduto: "Aplicação do produto",
  superficies: "Superfícies indicadas",
  superficie: "Superfície indicada",
  modoDeUso: "Modo de uso",
  diluicao: "Diluição",
  precaucoes: "Precauções",
  beneficios: "Benefícios",
  indicacao: "Indicação",
  quantidade: "Quantidade",
  tamanho: "Tamanho",
  cuidados: "Cuidados",
  caracteristicas: "Características",
  rendimento: "Rendimento",
  sujeiras: "Sujeiras atendidas",
  acabamento: "Acabamento",
  durabilidade: "Durabilidade",
  pH: "pH",
  vMolPH: "pH do V-Mol",
  vFlocPH: "pH do V-Floc",
  classificacaoAws: "Classificação AWS",
  bitola: "Bitola",
  correnteIndicada: "Corrente indicada",
  poloEPosicao: "Polo e posição",
  limiteResistencia: "Limite de resistência",
  limiteEscoamento: "Limite de escoamento",
  alongamento: "Alongamento",
  charpy: "Charpy",
  composicaoDeposito: "Composição do depósito",
  fabricacao: "Fabricação",
  composicao: "Composição",
  identificacao: "Identificação",
  processo: "Processo",
  corrente: "Corrente",
  diametro: "Diâmetro",
  espessura: "Espessura",
  furo: "Furo",
  conicidade: "Conicidade",
  rosca: "Rosca",
  rolamentosCompativeis: "Rolamentos compatíveis",
  itensInclusos: "Itens inclusos",
  liga: "Liga",
};

const SIGLAS = new Set(["aws", "din", "hb", "hrc", "mpa", "cc", "ca", "tig", "mig", "ncm", "sae", "iso", "abnt", "fds", "ghs", "onu", "uv", "rpm", "sku", "anvisa"]);

/**
 * A chave do JSON não tem acento (`codigoFabricante`, `estadoFisico`), e a
 * regra geral a devolvia assim para o comprador: "Codigo fabricante",
 * "Estado fisico". O acento volta por palavra, e só para palavras cuja grafia
 * sem acento não existe em português — nada aqui muda o sentido do rótulo.
 */
const ACENTOS: Record<string, string> = {
  acao: "ação", advertencia: "advertência", agua: "água", aagua: "à água", aparencia: "aparência",
  aplicacao: "aplicação", apresentacao: "apresentação", area: "área", ativacao: "ativação",
  cinematica: "cinemática", classificacao: "classificação", codigo: "código", compativeis: "compatíveis",
  composicao: "composição", conteudo: "conteúdo", diametro: "diâmetro", dimensoes: "dimensões",
  dinamica: "dinâmica", emissao: "emissão", espumacao: "espumação", fisico: "físico", fixacao: "fixação",
  fragrancia: "fragrância", frequencia: "frequência", informacoes: "informações", liquido: "líquido",
  manutencao: "manutenção", maquina: "máquina", nao: "não", notificacao: "notificação", observacoes: "observações",
  peliculas: "películas", po: "pó", precaucao: "precaução", precaucoes: "precauções", preparacao: "preparação",
  principio: "princípio", protecao: "proteção", quimica: "química", referencia: "referência", repeticao: "repetição",
  resistencia: "resistência", restricao: "restrição", restricoes: "restrições", rotacao: "rotação", rotulo: "rótulo",
  seguranca: "segurança", superficie: "superfície", ventilacao: "ventilação",
};

/** Unidade no fim da chave (`diametroMm`, `rotativaRpm`) sai entre parênteses. */
const UNIDADES = new Set(["mm", "ml", "pol", "polegadas", "gramas", "rpm"]);

function rotuloGeral(chave: string): string {
  const palavras = chave
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase()
    .split(/\s+/);
  const ultima = palavras.length > 1 && UNIDADES.has(palavras[palavras.length - 1]) ? palavras.pop()! : null;
  const texto = palavras
    .map((p) => (SIGLAS.has(p) ? p.toUpperCase() : ACENTOS[p] ?? p))
    .join(" ");
  const rotulo = texto.charAt(0).toUpperCase() + texto.slice(1);
  return ultima ? `${rotulo} (${SIGLAS.has(ultima) ? ultima.toUpperCase() : ultima})` : rotulo;
}

/** "101.6" → "101,6 mm". Sem zeros à toa: 14 é "14 mm", não "14,0 mm". */
export function formatarMm(n: number): string {
  return `${n.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} mm`;
}

export function fichaDoProduto(atributos: Record<string, unknown> | null | undefined): LinhaDaFicha[] {
  const entradas = Object.entries(atributos ?? {}).filter(
    ([k, v]) => !INTERNAS.has(k) && !k.startsWith("_") && v !== null && v !== undefined && String(v).trim() !== "",
  );

  const medidas: LinhaDaFicha[] = [];
  const outras: LinhaDaFicha[] = [];
  for (const [chave, bruto] of entradas) {
    if (MEDIDAS[chave]) {
      const n = Number(bruto);
      if (!medidaValida(n)) continue;
      medidas.push({ chave, rotulo: MEDIDAS[chave], valor: formatarMm(n), numero: n, unidade: "mm" });
    } else {
      outras.push({ chave, rotulo: ROTULOS[chave] ?? rotuloGeral(chave), valor: String(bruto).trim() });
    }
  }
  // Medida primeiro, na ordem em que a peça é lida (interno, externo, altura):
  // é a linha que decide se serve.
  const ordem = Object.keys(MEDIDAS);
  medidas.sort((a, b) => ordem.indexOf(a.chave) - ordem.indexOf(b.chave));
  return [...medidas, ...outras];
}
