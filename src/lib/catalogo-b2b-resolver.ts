export type AcaoItemCatalogoB2B = "INCLUIR" | "EXCLUIR";
export type EstrategiaPrecoB2B = "FIXO" | "DESCONTO";

export type ComponenteResolucaoB2B = {
  varianteId: string;
  quantidadeBaseNumerador: number;
  quantidadeBaseDenominador: number;
};

export type ItemResolucaoB2B = {
  id: string;
  produtoId: string;
  varianteId: string | null;
  acao: AcaoItemCatalogoB2B;
  estrategiaPreco: EstrategiaPrecoB2B;
  precoFixoCentavos: number | null;
  descontoPontosBase: number | null;
  quantidadeMinima: number;
  quantidadeMaxima: number | null;
  multiploVenda: number;
  quantidadePorEmbalagem: number;
  unidadeComercial: string;
  unidadesBaseNumerador: number;
  unidadesBaseDenominador: number;
  componentes?: ComponenteResolucaoB2B[];
};

export type AtribuicaoResolucaoB2B = {
  id: string;
  catalogoVersaoId: string;
  empresaId: string;
  unidadeId: string | null;
  prioridade: number;
  versao: number;
  vigenteDesde: Date;
  vigenteAte: Date | null;
  itens: ItemResolucaoB2B[];
};

export type EntradaResolucaoB2B = {
  agora: Date;
  empresaId: string;
  unidadeId: string | null;
  produtoId: string;
  varianteId: string | null;
  quantidade: number;
  precoBaseCentavos: number;
  atribuicoes: AtribuicaoResolucaoB2B[];
};

export type ResultadoResolucaoB2B =
  | { tipo: "OFERTA_PUBLICA"; precoUnitarioCentavos: number; totalCentavos: number }
  | { tipo: "INDISPONIVEL"; motivo: "QUANTIDADE" | "MINIMO" | "MAXIMO" | "MULTIPLO" | "EXCLUIDO"; catalogoVersaoId: string; itemId?: string }
  | {
      tipo: "OFERTA_B2B";
      catalogoVersaoId: string;
      atribuicaoId: string;
      itemId: string;
      precoUnitarioCentavos: number;
      totalCentavos: number;
      quantidadePorEmbalagem: number;
      unidadeComercial: string;
      unidadesBaseNumerador: number;
      unidadesBaseDenominador: number;
      componentes: ComponenteResolucaoB2B[];
    };

function maximoDivisorComum(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y !== 0) [x, y] = [y, x % y];
  return x || 1;
}

function multiplicarRazao(numerador: number, denominador: number, fator: number) {
  const novoNumerador = numerador * fator;
  const divisor = maximoDivisorComum(novoNumerador, denominador);
  return { numerador: novoNumerador / divisor, denominador: denominador / divisor };
}

function compararAtribuicoes(a: AtribuicaoResolucaoB2B, b: AtribuicaoResolucaoB2B): number {
  const especificidadeA = a.unidadeId === null ? 0 : 1;
  const especificidadeB = b.unidadeId === null ? 0 : 1;
  return especificidadeB - especificidadeA
    || b.prioridade - a.prioridade
    || b.versao - a.versao
    || a.id.localeCompare(b.id);
}

function compararItens(a: ItemResolucaoB2B, b: ItemResolucaoB2B): number {
  const varianteA = a.varianteId === null ? 0 : 1;
  const varianteB = b.varianteId === null ? 0 : 1;
  return varianteB - varianteA
    || Number(b.acao === "EXCLUIR") - Number(a.acao === "EXCLUIR")
    || b.quantidadeMinima - a.quantidadeMinima
    || Number(a.estrategiaPreco === "DESCONTO") - Number(b.estrategiaPreco === "DESCONTO")
    || a.id.localeCompare(b.id);
}

function precoDoItem(item: ItemResolucaoB2B, precoBaseCentavos: number): number {
  if (item.estrategiaPreco === "FIXO") return item.precoFixoCentavos ?? precoBaseCentavos;
  const pontosBase = Math.min(10_000, Math.max(0, item.descontoPontosBase ?? 0));
  return Math.floor((precoBaseCentavos * (10_000 - pontosBase) + 5_000) / 10_000);
}

function ofertaPublica(precoUnitarioCentavos: number, quantidade: number): ResultadoResolucaoB2B {
  return { tipo: "OFERTA_PUBLICA", precoUnitarioCentavos, totalCentavos: precoUnitarioCentavos * quantidade };
}

export function resolverOfertaB2B(entrada: EntradaResolucaoB2B): ResultadoResolucaoB2B {
  if (!Number.isSafeInteger(entrada.quantidade) || entrada.quantidade <= 0) {
    return { tipo: "INDISPONIVEL", motivo: "QUANTIDADE", catalogoVersaoId: "" };
  }

  const atribuicao = entrada.atribuicoes
    .filter((item) => item.empresaId === entrada.empresaId)
    .filter((item) => item.unidadeId === null || item.unidadeId === entrada.unidadeId)
    .filter((item) => item.vigenteDesde.getTime() <= entrada.agora.getTime())
    .filter((item) => item.vigenteAte === null || item.vigenteAte.getTime() > entrada.agora.getTime())
    .sort(compararAtribuicoes)[0];
  if (!atribuicao) return ofertaPublica(entrada.precoBaseCentavos, entrada.quantidade);

  const candidatos = atribuicao.itens
    .filter((item) => item.produtoId === entrada.produtoId)
    .filter((item) => item.varianteId === null || item.varianteId === entrada.varianteId)
    .sort(compararItens);
  if (candidatos.length === 0) return ofertaPublica(entrada.precoBaseCentavos, entrada.quantidade);

  const exclusao = candidatos.find((item) => item.acao === "EXCLUIR");
  if (exclusao) {
    return { tipo: "INDISPONIVEL", motivo: "EXCLUIDO", catalogoVersaoId: atribuicao.catalogoVersaoId, itemId: exclusao.id };
  }

  const inclusoes = candidatos.filter((item) => item.acao === "INCLUIR");
  const item = inclusoes.find((regra) => entrada.quantidade >= regra.quantidadeMinima && (regra.quantidadeMaxima === null || entrada.quantidade <= regra.quantidadeMaxima));
  if (!item) {
    const menorMinimo = Math.min(...inclusoes.map((regra) => regra.quantidadeMinima));
    const maiorMaximo = Math.max(...inclusoes.map((regra) => regra.quantidadeMaxima ?? Number.POSITIVE_INFINITY));
    if (entrada.quantidade < menorMinimo) return { tipo: "INDISPONIVEL", motivo: "MINIMO", catalogoVersaoId: atribuicao.catalogoVersaoId };
    if (entrada.quantidade > maiorMaximo) return { tipo: "INDISPONIVEL", motivo: "MAXIMO", catalogoVersaoId: atribuicao.catalogoVersaoId };
    return ofertaPublica(entrada.precoBaseCentavos, entrada.quantidade);
  }
  if (entrada.quantidade % item.multiploVenda !== 0) {
    return { tipo: "INDISPONIVEL", motivo: "MULTIPLO", catalogoVersaoId: atribuicao.catalogoVersaoId, itemId: item.id };
  }

  const precoUnitarioCentavos = precoDoItem(item, entrada.precoBaseCentavos);
  const unidadesBase = multiplicarRazao(item.unidadesBaseNumerador, item.unidadesBaseDenominador, entrada.quantidade);
  const componentes = (item.componentes ?? []).map((componente) => {
    const quantidade = multiplicarRazao(componente.quantidadeBaseNumerador, componente.quantidadeBaseDenominador, entrada.quantidade);
    return { varianteId: componente.varianteId, quantidadeBaseNumerador: quantidade.numerador, quantidadeBaseDenominador: quantidade.denominador };
  });
  return {
    tipo: "OFERTA_B2B",
    catalogoVersaoId: atribuicao.catalogoVersaoId,
    atribuicaoId: atribuicao.id,
    itemId: item.id,
    precoUnitarioCentavos,
    totalCentavos: precoUnitarioCentavos * entrada.quantidade,
    quantidadePorEmbalagem: item.quantidadePorEmbalagem,
    unidadeComercial: item.unidadeComercial,
    unidadesBaseNumerador: unidadesBase.numerador,
    unidadesBaseDenominador: unidadesBase.denominador,
    componentes,
  };
}
