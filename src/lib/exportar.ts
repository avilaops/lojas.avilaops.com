import { prisma } from "./db";
import { clientesDaLoja } from "./clientes";
import { condicaoDoCatalogo, type FiltroCatalogo } from "./catalogo-filtros";
import { COLUNAS_PRODUTO, TETO_EXPORTACAO } from "./planilha-produtos";
import { montarXlsx, type Celula } from "./xlsx";

/**
 * Exportação em planilha: pedidos, clientes e catálogo.
 *
 * Serve a três donos. O lojista que quer os pedidos no Excel; a obrigação de
 * LGPD de entregar os dados dos clientes finais quando pedidos por escrito
 * (a única exceção ao padrão fechado da plataforma — ver docs/CONFORMIDADE.md);
 * e o catálogo, que é a planilha que o próprio lojista subiu e que ele precisa
 * de volta para corrigir preço, medida e código em lote. O catálogo sai nas
 * mesmas colunas que a importação lê (`COLUNAS_PRODUTO`): baixa, corrige,
 * reimporta.
 *
 * Dois formatos, pelo que cada um resolve:
 * - **CSV** com ponto e vírgula, BOM e vírgula decimal — é o que faz o Excel
 *   em português abrir o arquivo já com as colunas separadas, sem assistente.
 * - **XLSX** quando o que importa é o tipo da célula: no CSV o Excel decide
 *   sozinho que "007" é 7 e que um GTIN de 13 dígitos é 7,89123E+12. É o
 *   formato de quem vai conferir, somar e mandar para o contador.
 *
 * A importação continua lendo .csv (`lerCsvProdutos`): quem baixa para
 * corrigir em lote e reenviar leva o CSV, que sai com as mesmas colunas.
 */
const BOM = "﻿";

/** Número que tem que continuar número na planilha, com casas fixas no CSV. */
type Decimal = { numero: number; casas: number };
export type Valor = Celula | Decimal;

const decimal = (numero: number, casas = 2): Decimal => ({ numero, casas });
const eDecimal = (v: Valor): v is Decimal => typeof v === "object" && v !== null && "numero" in v;

function celula(valor: unknown): string {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor);
  // Aspas duplicadas e o campo inteiro entre aspas quando há separador, aspas
  // ou quebra de linha — é o que a planilha espera.
  return /[;"\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function montarCsv(linhas: unknown[][]): string {
  return BOM + linhas.map((l) => l.map(celula).join(";")).join("\r\n") + "\r\n";
}

export type Formato = "csv" | "xlsx";

export const FORMATOS: Record<Formato, { tipo: string; extensao: string }> = {
  csv: { tipo: "text/csv; charset=utf-8", extensao: "csv" },
  xlsx: { tipo: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", extensao: "xlsx" },
};

/** As mesmas linhas nos dois formatos: o que muda é como a célula é escrita. */
export function montarPlanilha(linhas: Valor[][], formato: Formato, aba: string): string | Uint8Array<ArrayBuffer> {
  if (formato === "xlsx") {
    return montarXlsx(
      linhas.map((l) => l.map((v) => (eDecimal(v) ? v.numero : v))),
      { aba },
    );
  }
  return montarCsv(linhas.map((l) => l.map((v) => (eDecimal(v) ? v.numero.toFixed(v.casas).replace(".", ",") : v))));
}

const data = (d: Date) => d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
const reais = (centavos: number) => decimal(centavos / 100);

export async function pedidosEmLinhas(tenantId: string): Promise<Valor[][]> {
  const pedidos = await prisma.pedido.findMany({
    where: { tenantId },
    include: { itens: true },
    orderBy: { criadoEm: "desc" },
    take: TETO_EXPORTACAO.pedidos,
  });

  const linhas: Valor[][] = [[
    "Numero", "Referencia", "Data", "Status", "Cliente", "E-mail", "Telefone", "Documento",
    "Subtotal", "Desconto", "Cupom", "Frete", "Total", "Pagamento", "Entrega", "Rastreio", "Itens",
  ]];

  for (const p of pedidos) {
    const e = p.entrega as { logradouro?: string; numero?: string; bairro?: string; cidade?: string; uf?: string; cep?: string } | null;
    linhas.push([
      p.numero, p.referencia, data(p.criadoEm), p.status, p.clienteNome, p.clienteEmail,
      // Telefone e documento saem como texto de propósito: no XLSX um CPF
      // virando número perde o zero à esquerda.
      p.clienteTelefone, p.clienteDocumento,
      reais(p.subtotalCentavos), reais(p.descontoCentavos), p.cupomCodigo ?? "", reais(p.freteCentavos), reais(p.totalCentavos),
      p.meioPagamento,
      e ? `${e.logradouro ?? ""}, ${e.numero ?? ""} - ${e.bairro ?? ""}, ${e.cidade ?? ""}/${e.uf ?? ""} ${e.cep ?? ""}` : "Retirada na loja",
      p.rastreio ?? "",
      p.itens.map((i) => `${i.quantidade}x ${i.nome}${i.varianteNome ? ` (${i.varianteNome})` : ""}`).join(" | "),
    ]);
  }
  return linhas;
}

export async function clientesEmLinhas(tenantId: string): Promise<Valor[][]> {
  // A apuração é a mesma que alimenta a tela de Clientes (src/lib/clientes.ts):
  // arquivo e painel não podem discordar sobre quanto alguém gastou.
  const clientes = await clientesDaLoja(tenantId);
  const linhas: Valor[][] = [["Nome", "E-mail", "Telefone", "Documento", "Tem conta", "Pedidos", "Total gasto", "Primeira compra", "Ultima compra", "Endereco"]];
  for (const c of clientes) {
    linhas.push([c.nome, c.email, c.telefone, c.documento, c.temConta ? "sim" : "nao", c.pedidos, reais(c.gastoCentavos), data(c.primeiraCompra), data(c.ultimaCompra), c.endereco]);
  }
  return linhas;
}

const medida = (valor: number | null) => (valor && valor > 0 ? decimal(valor, 3) : "");

/** O produto como a planilha o vê. Só o que vira coluna: é o contrato entre
 *  o banco e o arquivo, e o que o teste consegue percorrer sem banco. */
export type ProdutoDePlanilha = {
  nome: string;
  precoCentavos: number;
  precoDeCentavos: number | null;
  googleProductCategory?: string | null;
  marca: string | null;
  sku: string | null;
  gtin: string | null;
  mpn?: string | null;
  identificadoresEstado?: "desconhecido" | "informado" | "sem_identificador";
  descricaoCurta: string | null;
  descricao: string | null;
  imagens: string[];
  atributos?: Record<string, unknown> | null;
  imagemOrigem?: string | null;
  imagemFamilia?: string | null;
  imagemConfirmada?: boolean;
  correspondenciaImagem?: "nao_confirmada" | "confirmada" | "rejeitada";
  destaque: boolean;
  ativo: boolean;
  estoque: number | null;
  pesoKg: number | null;
  alturaCm: number | null;
  larguraCm: number | null;
  comprimentoCm: number | null;
  categoria: { nome: string } | null;
};

/** Uma linha, na ordem de `COLUNAS_PRODUTO`. */
export function linhaDoProduto(p: ProdutoDePlanilha): Valor[] {
  return [
    p.nome,
    reais(p.precoCentavos),
    p.categoria?.nome ?? "",
    p.googleProductCategory ?? "",
    p.marca ?? "",
    p.sku ?? "",
    p.gtin ?? "",
    p.mpn ?? "",
    p.identificadoresEstado ?? "desconhecido",
    p.precoDeCentavos ? reais(p.precoDeCentavos) : "",
    p.descricaoCurta ?? "",
    p.descricao ?? "",
    p.imagens[0] ?? "",
    p.imagens.join("|"),
    JSON.stringify(p.atributos ?? {}),
    p.imagemOrigem ?? "propria",
    p.imagemFamilia ?? "",
    p.imagemConfirmada ? "sim" : "",
    p.correspondenciaImagem ?? (p.imagemConfirmada ? "confirmada" : "nao_confirmada"),
    p.destaque ? "sim" : "nao",
    medida(p.pesoKg),
    medida(p.alturaCm),
    medida(p.larguraCm),
    medida(p.comprimentoCm),
    // Estoque vazio é "sem controle" (∞), que não é zero: escrever 0 aqui
    // esgotaria o produto na volta da importação.
    p.estoque ?? "",
    p.ativo ? "sim" : "nao",
  ];
}

/**
 * O catálogo como planilha, respeitando o filtro que está na tela: quem
 * filtrou "sem preço" baixa os 5.588 sem preço, não o catálogo inteiro.
 */
export async function produtosEmLinhas(tenantId: string, filtro: FiltroCatalogo = {}): Promise<Valor[][]> {
  const produtos = await prisma.produto.findMany({
    where: condicaoDoCatalogo(tenantId, filtro),
    select: {
      nome: true, precoCentavos: true, precoDeCentavos: true, marca: true, sku: true, gtin: true,
      googleProductCategory: true, atributos: true,
      descricaoCurta: true, descricao: true, imagens: true, imagemOrigem: true, imagemFamilia: true, midias: { where: { varianteId: null, tipo: "imagem", ordem: 0 }, select: { correspondencia: true }, take: 1 }, destaque: true, ativo: true, estoque: true,
      pesoKg: true, alturaCm: true, larguraCm: true, comprimentoCm: true,
      categoria: { select: { nome: true } },
      variantes: { where: { padrao: true }, select: { mpn: true, identificadoresEstado: true }, take: 1 },
    },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    take: TETO_EXPORTACAO.produtos,
  });

  return [[...COLUNAS_PRODUTO], ...produtos.map((p) => linhaDoProduto({
    ...p,
    atributos: p.atributos && typeof p.atributos === "object" && !Array.isArray(p.atributos) ? p.atributos as Record<string, unknown> : null,
    mpn: p.variantes[0]?.mpn ?? null,
    identificadoresEstado: (p.variantes[0]?.identificadoresEstado ?? "desconhecido") as ProdutoDePlanilha["identificadoresEstado"],
    imagemConfirmada: p.midias[0]?.correspondencia === "confirmada",
    correspondenciaImagem: p.midias[0]?.correspondencia as ProdutoDePlanilha["correspondenciaImagem"],
  }))];
}
