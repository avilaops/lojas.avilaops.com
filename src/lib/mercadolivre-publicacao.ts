import type { Produto, Tenant } from "@prisma/client";
import { prisma } from "./db";
import { chamarMl, MercadoLivreNaoConectado } from "./mercadolivre";
import type { Preparo } from "./mercadolivre-preparo";
import { prepararCatalogo } from "./mercadolivre-preparo";
import { urlDaLoja } from "./tenant";

type ProdutoPublicavel = Pick<
  Produto,
  "id" | "nome" | "precoCentavos" | "estoque" | "imagens" | "descricaoCurta" | "descricao" | "ativo"
>;

type AnuncioParaPublicar = {
  id: string;
  categoriaMl: string | null;
  preparo: unknown;
  produto: ProdutoPublicavel;
};

export type CorpoPublicacaoMl = {
  title: string;
  category_id: string;
  price: number;
  currency_id: "BRL";
  available_quantity: number;
  buying_mode: "buy_it_now";
  listing_type_id: "gold_special";
  condition: "new";
  channels: ["marketplace"];
  pictures: Array<{ source: string }>;
  attributes: Array<{ id: string; value_name: string }>;
};

export type ResumoMercadoLivre = {
  lojas: number;
  preparados: number;
  publicados: number;
  sincronizados: number;
  ignorados: number;
  falhas: number;
  detalhes: Array<{ loja: string; produto?: string; etapa: string; resultado: string }>;
};

function textoCurto(valor: unknown, limite: number): string {
  return String(valor ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limite);
}

function imagemAbsoluta(base: string, imagem: string): string | null {
  try {
    const url = new URL(imagem, base);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function lerPreparo(valor: unknown): Preparo | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const preparo = valor as unknown as Partial<Preparo>;
  return preparo.estado && preparo.nomeEnriquecido && Array.isArray(preparo.presentes)
    ? (preparo as Preparo)
    : null;
}

/** Monta apenas fatos já aprovados no preparo. Não inventa marca, GTIN ou categoria. */
export function corpoDaPublicacaoMl(
  anuncio: AnuncioParaPublicar,
  base: string,
): { corpo?: CorpoPublicacaoMl; erro?: string } {
  const preparo = lerPreparo(anuncio.preparo);
  if (!preparo || preparo.estado !== "PRONTO") return { erro: "O preparo do produto não está aprovado como PRONTO." };
  if (!anuncio.categoriaMl) return { erro: "Falta a categoria do Mercado Livre." };
  if (!anuncio.produto.ativo) return { erro: "O produto está inativo na loja." };
  if (anuncio.produto.precoCentavos <= 0) return { erro: "O produto não tem preço de venda." };
  if ((anuncio.produto.estoque ?? 0) <= 0) return { erro: "O produto não tem estoque disponível." };

  const pictures = anuncio.produto.imagens
    .map((imagem) => imagemAbsoluta(base, imagem))
    .filter((imagem): imagem is string => Boolean(imagem))
    .slice(0, 10)
    .map((source) => ({ source }));
  if (!pictures.length) return { erro: "O produto não tem imagem pública válida." };

  const atributos = new Map<string, string>();
  for (const atributo of preparo.presentes) {
    const id = textoCurto(atributo.id, 80);
    const valor = textoCurto(atributo.valor, 255);
    if (id && valor) atributos.set(id, valor);
  }

  return {
    corpo: {
      title: textoCurto(preparo.nomeEnriquecido, 60),
      category_id: anuncio.categoriaMl,
      price: Number((anuncio.produto.precoCentavos / 100).toFixed(2)),
      currency_id: "BRL",
      available_quantity: Math.max(1, Math.trunc(anuncio.produto.estoque ?? 0)),
      buying_mode: "buy_it_now",
      listing_type_id: "gold_special",
      condition: "new",
      channels: ["marketplace"],
      pictures,
      attributes: [...atributos].map(([id, value_name]) => ({ id, value_name })),
    },
  };
}

async function publicarAprovados(loja: Tenant, limite: number, resumo: ResumoMercadoLivre) {
  const anuncios = await prisma.anuncioMercadoLivre.findMany({
    where: { tenantId: loja.id, estado: "aprovado", mlbId: null, preparoEstado: "PRONTO" },
    include: { produto: true },
    orderBy: { atualizadoEm: "asc" },
    take: limite,
  });
  const base = urlDaLoja(loja);

  for (const anuncio of anuncios) {
    const montado = corpoDaPublicacaoMl(anuncio, base);
    if (!montado.corpo) {
      resumo.ignorados++;
      await prisma.anuncioMercadoLivre.update({
        where: { id: anuncio.id },
        data: { estado: "rascunho", motivoErro: montado.erro },
      });
      resumo.detalhes.push({ loja: loja.slug, produto: anuncio.produto.nome, etapa: "publicar", resultado: montado.erro ?? "ignorado" });
      continue;
    }

    try {
      // O validador oficial não cria anúncio e devolve as exigências atuais da categoria.
      await chamarMl(loja, "/items/validate", { method: "POST", body: JSON.stringify(montado.corpo) });
      const criado = await chamarMl<{ id: string; permalink?: string; status?: string }>(loja, "/items", {
        method: "POST",
        body: JSON.stringify(montado.corpo),
      });
      await prisma.anuncioMercadoLivre.update({
        where: { id: anuncio.id },
        data: {
          mlbId: criado.id,
          permalink: criado.permalink ?? null,
          statusMl: criado.status ?? "active",
          estado: "publicado",
          motivoErro: null,
          precoCentavosPublicado: anuncio.produto.precoCentavos,
          estoquePublicado: anuncio.produto.estoque ?? 0,
          sincronizadoEm: new Date(),
        },
      });
      resumo.publicados++;
    } catch (erro) {
      const mensagem = textoCurto(erro instanceof Error ? erro.message : "Falha desconhecida.", 1000);
      await prisma.anuncioMercadoLivre.update({ where: { id: anuncio.id }, data: { estado: "recusado", motivoErro: mensagem } });
      resumo.falhas++;
      resumo.detalhes.push({ loja: loja.slug, produto: anuncio.produto.nome, etapa: "publicar", resultado: mensagem });
    }
  }
}

async function sincronizarPublicados(loja: Tenant, limite: number, resumo: ResumoMercadoLivre) {
  const anuncios = await prisma.anuncioMercadoLivre.findMany({
    where: { tenantId: loja.id, estado: "publicado", mlbId: { not: null } },
    include: { produto: true },
    orderBy: [{ sincronizadoEm: "asc" }, { atualizadoEm: "asc" }],
    take: limite,
  });

  for (const anuncio of anuncios) {
    if (!anuncio.mlbId) continue;
    try {
      const atual = await chamarMl<{ status?: string; price?: number; available_quantity?: number; permalink?: string }>(loja, `/items/${encodeURIComponent(anuncio.mlbId)}`);
      if (atual.status === "closed") {
        await prisma.anuncioMercadoLivre.update({
          where: { id: anuncio.id },
          data: { estado: "pausado", statusMl: "closed", permalink: atual.permalink ?? anuncio.permalink, sincronizadoEm: new Date() },
        });
        resumo.ignorados++;
        continue;
      }

      const estoque = anuncio.produto.ativo ? Math.max(0, Math.trunc(anuncio.produto.estoque ?? 0)) : 0;
      const preco = Number((anuncio.produto.precoCentavos / 100).toFixed(2));
      const mudouEstoque = atual.available_quantity !== estoque;
      const mudouPreco = anuncio.produto.precoCentavos > 0 && atual.price !== preco;

      if (mudouEstoque || mudouPreco) {
        const corpo: Record<string, number> = {};
        // Desde março de 2026 o ML rejeita atualização contendo somente preço.
        // Repetir a quantidade atual é inofensivo e mantém a alteração no endpoint
        // de item, sem inventar outro campo comercial só para contornar a regra.
        if (mudouEstoque || mudouPreco) corpo.available_quantity = estoque;
        if (mudouPreco) corpo.price = preco;
        await chamarMl(loja, `/items/${encodeURIComponent(anuncio.mlbId)}`, { method: "PUT", body: JSON.stringify(corpo) });
      }

      const confirmado = await chamarMl<{ status?: string; price?: number; available_quantity?: number; permalink?: string }>(loja, `/items/${encodeURIComponent(anuncio.mlbId)}`);
      const problemas: string[] = [];
      if (confirmado.available_quantity !== estoque) problemas.push("O Mercado Livre não confirmou o novo estoque; a conta pode usar estoque multiorigem.");
      if (anuncio.produto.precoCentavos > 0 && confirmado.price !== preco) problemas.push("O Mercado Livre não confirmou o novo preço; pode existir automação de preço ativa.");

      await prisma.anuncioMercadoLivre.update({
        where: { id: anuncio.id },
        data: {
          statusMl: confirmado.status ?? atual.status ?? null,
          permalink: confirmado.permalink ?? atual.permalink ?? anuncio.permalink,
          motivoErro: problemas.length ? problemas.join(" ") : null,
          precoCentavosPublicado: confirmado.price === preco ? anuncio.produto.precoCentavos : anuncio.precoCentavosPublicado,
          estoquePublicado: confirmado.available_quantity === estoque ? estoque : anuncio.estoquePublicado,
          sincronizadoEm: new Date(),
        },
      });
      if (problemas.length) {
        resumo.falhas++;
        resumo.detalhes.push({ loja: loja.slug, produto: anuncio.produto.nome, etapa: "sincronizar", resultado: problemas.join(" ") });
      } else {
        resumo.sincronizados++;
      }
    } catch (erro) {
      const mensagem = textoCurto(erro instanceof Error ? erro.message : "Falha desconhecida.", 1000);
      await prisma.anuncioMercadoLivre.update({ where: { id: anuncio.id }, data: { motivoErro: mensagem, sincronizadoEm: new Date() } });
      resumo.falhas++;
      resumo.detalhes.push({ loja: loja.slug, produto: anuncio.produto.nome, etapa: "sincronizar", resultado: mensagem });
    }
  }
}

/** Rotina idempotente chamada pelo n8n. Sem conexão ou aprovação, não publica. */
export async function rodarMercadoLivre(opcoes: { slug?: string; limite?: number; preparar?: number } = {}): Promise<ResumoMercadoLivre> {
  const limite = Math.min(Math.max(opcoes.limite ?? 20, 1), 100);
  const preparar = Math.min(Math.max(opcoes.preparar ?? 10, 0), 50);
  const lojas = await prisma.tenant.findMany({
    where: {
      status: "ATIVA",
      mlAccessTokenEnc: { not: null },
      mlRefreshTokenEnc: { not: null },
      ...(opcoes.slug ? { slug: opcoes.slug } : {}),
    },
  });
  const resumo: ResumoMercadoLivre = { lojas: lojas.length, preparados: 0, publicados: 0, sincronizados: 0, ignorados: 0, falhas: 0, detalhes: [] };

  for (const loja of lojas) {
    try {
      if (preparar > 0) {
        const pendentes = await prisma.produto.count({ where: { tenantId: loja.id, ativo: true, anunciosMl: { none: {} } } });
        if (pendentes > 0) {
          const resultado = await prepararCatalogo(loja.id, {
            limite: Math.min(preparar, pendentes),
            somenteSemAnuncio: true,
          });
          resumo.preparados += resultado.total;
        }
      }
      await publicarAprovados(loja, limite, resumo);
      await sincronizarPublicados(loja, limite, resumo);
    } catch (erro) {
      const mensagem = textoCurto(erro instanceof MercadoLivreNaoConectado || erro instanceof Error ? erro.message : "Falha desconhecida.", 1000);
      resumo.falhas++;
      resumo.detalhes.push({ loja: loja.slug, etapa: "loja", resultado: mensagem });
    }
  }
  return resumo;
}
