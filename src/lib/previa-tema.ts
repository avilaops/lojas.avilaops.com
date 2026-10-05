import type { Categoria, Produto, Tenant } from "@prisma/client";
import { TemaSchema, type TemaLoja } from "./tema";

/**
 * Prévia do tema no painel: o rascunho que o lojista ainda não salvou, sobre
 * um catálogo de demonstração.
 *
 * Tudo aqui é puro, sem banco e sem nada de requisição, porque o mesmo arquivo roda
 * no navegador (o formulário monta o link) e no servidor (a página lê o link).
 * A prévia nunca grava: o rascunho viaja na URL e morre com a aba.
 */

/**
 * Teto do rascunho codificado. O tema premium preenchido inteiro fica perto de
 * 2 mil caracteres; acima disto o endereço começa a esbarrar no limite de
 * cabeçalho do servidor, e o formulário troca o link por um aviso.
 */
export const LIMITE_RASCUNHO = 12000;

const BASE64URL = /^[A-Za-z0-9_-]+$/;

/** Tema → texto que cabe em `?t=` (JSON em base64url, sem preenchimento). */
export function codificarRascunho(tema: TemaLoja): string {
  const bytes = new TextEncoder().encode(JSON.stringify(tema));
  let binario = "";
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Texto de `?t=` → tema, ou `null`.
 *
 * Não usa `lerTema` de propósito: lá o que não valida vira o tema padrão, e uma
 * prévia que mostra o tema padrão no lugar do rascunho é uma prévia que mente.
 * Aqui o que não valida não desenha nada.
 */
export function lerRascunho(texto: string | undefined): TemaLoja | null {
  if (!texto || texto.length > LIMITE_RASCUNHO || !BASE64URL.test(texto)) return null;
  try {
    const binario = atob(texto.replace(/-/g, "+").replace(/_/g, "/"));
    const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
    const bruto: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    const r = TemaSchema.safeParse(bruto);
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

/** A loja como ficaria com o rascunho. Devolve cópia; a recebida não muda. */
export function lojaDaPrevia(loja: Tenant, tema: TemaLoja): Tenant {
  return { ...loja, tema };
}

const TENANT_DEMO = "demo-loja";
const DATA_DEMO = new Date("2026-01-01T12:00:00.000Z");

function categoriaDemo(ordem: number, slug: string, nome: string, descricao: string): Categoria {
  return {
    id: `demo-cat-${slug}`,
    tenantId: TENANT_DEMO,
    slug,
    nome,
    descricao,
    imagemUrl: null,
    ordem,
    seoTitle: null,
    seoDescription: null,
    seoKeywords: [],
    seoPendente: false,
    seoOrigem: null,
    seoModelo: null,
    seoAtualizadoEm: null,
    seoProcessandoEm: null,
    seoErro: null,
    criadoEm: DATA_DEMO,
    atualizadoEm: DATA_DEMO,
  };
}

type ProdutoDemo = Pick<Produto, "slug" | "nome" | "precoCentavos"> & { categoria: string } & Partial<Produto>;

function produtoDemo({ categoria, ...p }: ProdutoDemo): Produto {
  return {
    id: `demo-prod-${p.slug}`,
    tenantId: TENANT_DEMO,
    categoriaId: `demo-cat-${categoria}`,
    marca: "Marca Demo",
    sku: null,
    gtin: null,
    googleProductCategory: null,
    precoDeCentavos: null,
    descricaoCurta: null,
    descricao: null,
    // Sem foto: a prévia não empresta imagem de loja nenhuma, e o cartão já
    // sabe se desenhar sem ela.
    imagens: [],
    imagemOrigem: "propria",
    imagemFamilia: null,
    destaque: false,
    ativo: true,
    disponibilidade: "in_stock",
    estoque: 20,
    pesoKg: null,
    alturaCm: null,
    larguraCm: null,
    comprimentoCm: null,
    atributos: {},
    camposPersonalizados: {},
    codigoOriginal: null,
    codigosEquivalentes: [],
    compatibilidade: [],
    tarja: "nenhuma",
    principioAtivo: null,
    apresentacao: null,
    registroAnvisa: null,
    tipoMedicamento: null,
    opcoes: [],
    criadoEm: DATA_DEMO,
    atualizadoEm: DATA_DEMO,
    versaoCatalogo: 1,
    busca: "",
    ...p,
  };
}

/**
 * Catálogo fixo da prévia. Não é de loja nenhuma: os ids começam com `demo-`
 * e nada aqui existe no banco.
 *
 * Os slugs `lavagem`, `polimento` e `vitrificacao` são os das etapas do tema
 * premium de exemplo (`tests/fixtures/tema-premium-completo.json`), e as quatro
 * peças trazem código, equivalentes, medidas e aplicação para a tabela do
 * `catalogo-tecnico` aparecer com todas as colunas.
 */
export function catalogoDeDemonstracao(): { categorias: Categoria[]; vitrine: Produto[] } {
  const categorias = [
    categoriaDemo(1, "lavagem", "Lavagem", "Shampoos, luvas e baldes para lavar sem riscar."),
    categoriaDemo(2, "polimento", "Polimento", "Compostos e boinas para corrigir a pintura."),
    categoriaDemo(3, "vitrificacao", "Vitrificação", "Proteção que sela o resultado por meses."),
    categoriaDemo(4, "interior", "Interior", "Limpeza e conservação de painel, bancos e carpete."),
    categoriaDemo(5, "acessorios", "Acessórios", "Panos, aplicadores e organizadores."),
    categoriaDemo(6, "pecas", "Peças de reposição", "Filtros, pastilhas, correias e velas."),
  ];

  const vitrine = [
    produtoDemo({ categoria: "lavagem", slug: "shampoo-neutro-500ml", nome: "Shampoo neutro concentrado 500 ml", precoCentavos: 3990, precoDeCentavos: 4990, descricaoCurta: "Rende até 50 lavagens.", destaque: true }),
    produtoDemo({ categoria: "lavagem", slug: "luva-microfibra", nome: "Luva de microfibra para lavagem", precoCentavos: 2490, descricaoCurta: "Fios longos que seguram a sujeira." }),
    produtoDemo({ categoria: "polimento", slug: "composto-polidor-corte-medio", nome: "Composto polidor de corte médio 250 g", precoCentavos: 6990, descricaoCurta: "Remove riscos leves e marcas de lavagem.", destaque: true }),
    produtoDemo({ categoria: "polimento", slug: "boina-espuma-5pol", nome: "Boina de espuma 5 polegadas", precoCentavos: 3290, descricaoCurta: "Para refino e lustro." }),
    produtoDemo({ categoria: "vitrificacao", slug: "vitrificador-pintura-30ml", nome: "Vitrificador de pintura 30 ml", precoCentavos: 18990, precoDeCentavos: 21990, descricaoCurta: "Proteção de até 12 meses.", destaque: true }),
    produtoDemo({ categoria: "vitrificacao", slug: "cera-sintetica-200g", nome: "Cera sintética em pasta 200 g", precoCentavos: 5490, descricaoCurta: "Brilho e repelência à água." }),
    produtoDemo({ categoria: "interior", slug: "limpador-multiuso-interior", nome: "Limpador multiuso para interior 500 ml", precoCentavos: 2990, descricaoCurta: "Painel, portas e bancos." }),
    produtoDemo({ categoria: "acessorios", slug: "kit-panos-microfibra", nome: "Kit com 3 panos de microfibra", precoCentavos: 3490, descricaoCurta: "Secagem e acabamento sem fiapos." }),
    produtoDemo({
      categoria: "pecas", slug: "filtro-de-oleo-fo-1020", nome: "Filtro de óleo FO-1020", precoCentavos: 3290,
      sku: "FO-1020", codigoOriginal: "OE-15400-A01", codigosEquivalentes: ["EQ-7143", "EQ-W610"],
      compatibilidade: [{ marca: "Montadora", modelo: "Hatch 1.0", anoDe: 2018, anoAte: 2023 }, { marca: "Montadora", modelo: "Sedã 1.6", anoDe: 2019 }],
      comprimentoCm: 7, larguraCm: 7, alturaCm: 9, pesoKg: 0.25,
    }),
    produtoDemo({
      categoria: "pecas", slug: "pastilha-de-freio-pf-2210", nome: "Pastilha de freio dianteira PF-2210", precoCentavos: 12990,
      sku: "PF-2210", codigoOriginal: "OE-45022-B12", codigosEquivalentes: ["EQ-N1432"],
      compatibilidade: [{ marca: "Montadora", modelo: "Sedã 1.6", anoDe: 2016, anoAte: 2022 }],
      comprimentoCm: 13, larguraCm: 6, alturaCm: 1.7, pesoKg: 0.9,
    }),
    produtoDemo({
      categoria: "pecas", slug: "correia-dentada-cd-3305", nome: "Correia dentada CD-3305", precoCentavos: 8990,
      sku: "CD-3305", codigoOriginal: "OE-14400-C07", codigosEquivalentes: ["EQ-5508XS", "EQ-CT1028"],
      compatibilidade: [{ marca: "Montadora", modelo: "Hatch 1.0", anoDe: 2015, anoAte: 2021 }, { marca: "Montadora", modelo: "Picape 1.4" }, { marca: "Montadora", modelo: "Utilitário 1.8", anoDe: 2017 }],
      comprimentoCm: 18, larguraCm: 12, alturaCm: 2.5, pesoKg: 0.18,
    }),
    produtoDemo({
      categoria: "pecas", slug: "vela-de-ignicao-vi-4400", nome: "Vela de ignição VI-4400", precoCentavos: 2790,
      sku: "VI-4400", codigoOriginal: "OE-98079-D55", codigosEquivalentes: ["EQ-BKR6E"],
      compatibilidade: [{ marca: "Montadora", modelo: "Hatch 1.0", anoDe: 2014, anoAte: 2020 }],
      comprimentoCm: 8, larguraCm: 2, alturaCm: 2, pesoKg: 0.05,
    }),
  ];

  return { categorias, vitrine };
}
