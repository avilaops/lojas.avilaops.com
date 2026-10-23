import { diagnosticarProduto, midiasDaOferta, type OcorrenciaCatalogo, type ProdutoCatalogo } from "./catalogo-qualidade";
import { ofertaDaVariante } from "./catalogo-oferta";
import { marcaConfirmada } from "./marca-confirmada";

const CAMPOS = ["nome", "categoria", "marca", "sku", "unidade", "ncm", "descricao", "imagem", "estoque", "preco", "medidas"] as const;
type CampoGovernanca = typeof CAMPOS[number];
type FamiliaCatalogo = "retentor" | "oring" | "rolamento" | "outra";

export interface LinhaGovernancaCatalogo {
  chave: string;
  produtoId: string;
  varianteId: string;
  sku: string | null;
  skuNormalizado: string | null;
  familia: FamiliaCatalogo;
  precoCentavos: number;
  estoque: number | null;
  estoqueControlado: boolean;
  campos: Record<CampoGovernanca, boolean>;
  ocorrencias: OcorrenciaCatalogo[];
  estado: "COMPLETO" | "COM_AVISOS" | "BLOQUEADO";
}

type Cobertura = { preenchidos: number; total: number; percentual: number };

export interface RelatorioGovernancaCatalogo {
  resumo: {
    produtos: number;
    skus: number;
    camposObrigatorios: number;
    camposPreenchidos: number;
    coberturaPercentual: number;
    bloqueados: number;
    avisos: number;
    duplicidades: number;
    conflitosPreco: number;
  };
  coberturaPorCampo: Record<CampoGovernanca, Cobertura>;
  coberturaPorFamilia: Array<Cobertura & { familia: FamiliaCatalogo; skus: number; bloqueados: number }>;
  conflitos: Array<{ skuNormalizado: string; produtoIds: string[]; skus: string[]; precosCentavos: number[] }>;
  linhas: LinhaGovernancaCatalogo[];
}

function normalizar(valor: string | null | undefined): string {
  return (valor ?? "").normalize("NFD").replace(/\p{M}+/gu, "").trim().toLowerCase();
}

export function normalizarSku(valor: string | null | undefined): string | null {
  const sku = (valor ?? "").trim().toUpperCase().replace(/[^A-Z0-9]+/g, "");
  return sku || null;
}

function familiaDaCategoria(nome: string | null | undefined): FamiliaCatalogo {
  const categoria = normalizar(nome);
  if (/\bretentor(?:es)?\b/.test(categoria)) return "retentor";
  if (/\b(?:o[ -]?rings?|aneis? o)\b/.test(categoria)) return "oring";
  if (/\brolamento(?:s)?\b/.test(categoria)) return "rolamento";
  return "outra";
}

function preenchido(valor: unknown): boolean {
  return valor !== null && valor !== undefined && String(valor).trim() !== "";
}

function ncmValido(...valores: unknown[]): boolean {
  return valores.some((valor) => typeof valor === "string" && /^\d{8}$/.test(valor.replace(/\D/g, "")));
}

function medidaPositiva(atributos: Record<string, unknown>, ...chaves: string[]): boolean {
  return chaves.some((chave) => {
    const valor = Number(atributos[chave]);
    return Number.isFinite(valor) && valor > 0;
  });
}

function medidasPreenchidas(familia: FamiliaCatalogo, atributos: Record<string, unknown>): boolean {
  if (familia === "retentor" || familia === "oring") {
    return medidaPositiva(atributos, "diametroInternoMm")
      && medidaPositiva(atributos, "diametroExternoMm")
      && medidaPositiva(atributos, "alturaMm", "secaoMm");
  }
  if (familia === "rolamento") {
    return medidaPositiva(atributos, "diametroInternoMm", "diametroInternoRolamentoMm")
      && medidaPositiva(atributos, "diametroExternoMm")
      && medidaPositiva(atributos, "larguraMm", "alturaMm");
  }
  return Object.entries(atributos).some(([chave, valor]) => {
    if (!/(?:Mm|medida|bitola|diametro|altura|largura|comprimento|espessura|secao)/i.test(chave)) return false;
    if (/Mm$/i.test(chave)) return Number.isFinite(Number(valor)) && Number(valor) > 0;
    return preenchido(valor);
  });
}

function percentual(preenchidos: number, total: number): number {
  return total ? Number(((preenchidos / total) * 100).toFixed(2)) : 100;
}

function ocorrencia(regra: string, campo: string, mensagem: string, acao: string, varianteId: string): OcorrenciaCatalogo {
  return { regra, versao: 1, campo, severidade: "erro", canal: "loja", mensagem, acao, varianteId };
}

function estadoDa(linha: Pick<LinhaGovernancaCatalogo, "ocorrencias">): LinhaGovernancaCatalogo["estado"] {
  if (linha.ocorrencias.some((item) => item.severidade === "erro")) return "BLOQUEADO";
  if (linha.ocorrencias.length) return "COM_AVISOS";
  return "COMPLETO";
}

export function relatorioDeGovernanca(produtos: ProdutoCatalogo[]): RelatorioGovernancaCatalogo {
  const linhas: LinhaGovernancaCatalogo[] = [];

  for (const produto of produtos) {
    const atributos = (produto.atributos ?? {}) as Record<string, unknown>;
    const familia = familiaDaCategoria(produto.categoria?.nome);
    const diagnostico = diagnosticarProduto(produto);

    for (const variante of produto.variantes.filter((item) => item.ativo)) {
      const oferta = ofertaDaVariante(variante);
      const sku = (variante.sku ?? (variante.padrao ? produto.sku : null))?.trim() || null;
      const skuNormalizado = normalizarSku(sku);
      const campos: Record<CampoGovernanca, boolean> = {
        nome: Boolean(produto.nome.trim()),
        categoria: Boolean(produto.categoriaId && produto.categoria?.nome.trim()),
        marca: Boolean(marcaConfirmada(produto.marca)),
        sku: Boolean(skuNormalizado),
        unidade: preenchido(atributos.unidade) || preenchido(atributos.unidadeVenda),
        ncm: ncmValido(produto.ncm, atributos.ncm),
        descricao: Boolean(produto.descricao?.trim() || produto.descricaoCurta?.trim()),
        imagem: midiasDaOferta(produto, variante.id).length > 0,
        estoque: variante.saldos.length > 0,
        preco: Number.isSafeInteger(oferta.precoCentavos) && oferta.precoCentavos > 0,
        medidas: medidasPreenchidas(familia, atributos),
      };
      const ocorrencias = diagnostico.filter((item) => !item.varianteId || item.varianteId === variante.id);
      for (const campo of CAMPOS) {
        if (campos[campo]) continue;
        const regra = campo === "medidas" ? "medidas_familia_ausentes" : `${campo}_governanca_ausente`;
        ocorrencias.push(ocorrencia(
          regra,
          campo,
          campo === "medidas" ? `Faltam medidas obrigatórias para a família ${familia}.` : `O campo obrigatório ${campo} não está preenchido.`,
          campo === "medidas" ? "Cadastre as medidas técnicas confirmadas da família." : `Preencha ${campo} com o dado confirmado.`,
          variante.id,
        ));
      }
      const linha: LinhaGovernancaCatalogo = {
        chave: skuNormalizado ? `sku:${skuNormalizado}` : `produto:${produto.id}:variante:${variante.id}`,
        produtoId: produto.id,
        varianteId: variante.id,
        sku,
        skuNormalizado,
        familia,
        precoCentavos: oferta.precoCentavos,
        estoque: oferta.estoque,
        estoqueControlado: variante.saldos.length > 0 && variante.saldos.every((saldo) => saldo.fisico !== null),
        campos,
        ocorrencias,
        estado: "COMPLETO",
      };
      linha.estado = estadoDa(linha);
      linhas.push(linha);
    }
  }

  const grupos = new Map<string, LinhaGovernancaCatalogo[]>();
  for (const linha of linhas) {
    if (!linha.skuNormalizado) continue;
    const grupo = grupos.get(linha.skuNormalizado) ?? [];
    grupo.push(linha);
    grupos.set(linha.skuNormalizado, grupo);
  }

  const conflitos: RelatorioGovernancaCatalogo["conflitos"] = [];
  let duplicidades = 0;
  for (const [skuNormalizado, grupo] of grupos) {
    const produtoIds = [...new Set(grupo.map((linha) => linha.produtoId))].sort();
    if (produtoIds.length < 2) continue;
    duplicidades += 1;
    const precosCentavos = [...new Set(grupo.map((linha) => linha.precoCentavos))].sort((a, b) => a - b);
    const skus = [...new Set(grupo.map((linha) => linha.sku).filter((sku): sku is string => Boolean(sku)))];
    for (const linha of grupo) {
      linha.ocorrencias.push(ocorrencia("sku_duplicado", "sku", "O mesmo SKU identifica produtos distintos.", "Consolide os produtos ou corrija o código confirmado.", linha.varianteId));
      if (precosCentavos.length > 1) linha.ocorrencias.push(ocorrencia("preco_conflitante", "preco", "O mesmo SKU possui preços diferentes.", "Confirme o preço vigente antes de publicar.", linha.varianteId));
      linha.estado = estadoDa(linha);
    }
    conflitos.push({ skuNormalizado, produtoIds, skus, precosCentavos });
  }
  conflitos.sort((a, b) => a.skuNormalizado.localeCompare(b.skuNormalizado));

  const coberturaPorCampo = Object.fromEntries(CAMPOS.map((campo) => {
    const preenchidos = linhas.filter((linha) => linha.campos[campo]).length;
    return [campo, { preenchidos, total: linhas.length, percentual: percentual(preenchidos, linhas.length) }];
  })) as Record<CampoGovernanca, Cobertura>;
  const familias = [...new Set(linhas.map((linha) => linha.familia))].sort();
  const coberturaPorFamilia = familias.map((familia) => {
    const daFamilia = linhas.filter((linha) => linha.familia === familia);
    const total = daFamilia.length * CAMPOS.length;
    const preenchidos = daFamilia.reduce((soma, linha) => soma + CAMPOS.filter((campo) => linha.campos[campo]).length, 0);
    return { familia, skus: daFamilia.length, preenchidos, total, percentual: percentual(preenchidos, total), bloqueados: daFamilia.filter((linha) => linha.estado === "BLOQUEADO").length };
  });
  const camposObrigatorios = linhas.length * CAMPOS.length;
  const camposPreenchidos = Object.values(coberturaPorCampo).reduce((soma, cobertura) => soma + cobertura.preenchidos, 0);

  return {
    resumo: {
      produtos: new Set(linhas.map((linha) => linha.produtoId)).size,
      skus: linhas.length,
      camposObrigatorios,
      camposPreenchidos,
      coberturaPercentual: percentual(camposPreenchidos, camposObrigatorios),
      bloqueados: linhas.filter((linha) => linha.estado === "BLOQUEADO").length,
      avisos: linhas.filter((linha) => linha.estado === "COM_AVISOS").length,
      duplicidades,
      conflitosPreco: conflitos.filter((conflito) => conflito.precosCentavos.length > 1).length,
    },
    coberturaPorCampo,
    coberturaPorFamilia,
    conflitos,
    linhas,
  };
}
