import { createHash } from "node:crypto";
import type { Produto, Tenant } from "@prisma/client";
import { prisma } from "./db";
import { chamarMl, MercadoLivreNaoConectado } from "./mercadolivre";
import type { Preparo } from "./mercadolivre-preparo";
import { prepararCatalogo } from "./mercadolivre-preparo";
import { urlDaLoja } from "./tenant";
import {
  REGRAS_PADRAO,
  estoqueDoCanal,
  impedimentoNoCanal,
  lerRegrasDoCanal,
  precoDoCanal,
  resolverRegrasDoCanal,
  type RegrasDoCanal,
} from "./canais";
import { atualizarReputacaoMl } from "./mercadolivre-reputacao";

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
  /** `gold_special` é o Clássico; `gold_pro`, o Premium. Ver RegrasDoCanal.tipoAnuncio. */
  listing_type_id: "gold_special" | "gold_pro";
  condition: "new" | "used";
  channels: ["marketplace"];
  pictures: Array<{ source: string }>;
  attributes: Array<{ id: string; value_name: string }>;
  /**
   * Garantia. O ML separa `sale_terms` de `attributes` porque é condição de
   * venda, não característica do produto — e recusa o anúncio em boa parte das
   * categorias quando ela falta. Sai daqui só quando o lojista respondeu.
   */
  sale_terms?: Array<{ id: string; value_name: string }>;
};

/** Garantia do lojista → o par que o Mercado Livre espera em `sale_terms`. */
function termosDeVenda(r: RegrasDoCanal): CorpoPublicacaoMl["sale_terms"] {
  if (r.garantia === "sem") return undefined;
  return [
    { id: "WARRANTY_TYPE", value_name: r.garantia === "fabrica" ? "Garantia de fábrica" : "Garantia do vendedor" },
    { id: "WARRANTY_TIME", value_name: `${r.garantiaMeses} ${r.garantiaMeses === 1 ? "mês" : "meses"}` },
  ];
}

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
    // A tag vira espaço, e `<strong>três meses</strong>.` virava "três meses ."
    // no anúncio publicado. Espaço antes de pontuação é erro de digitação aos
    // olhos de quem lê — e quem lê aqui é o comprador.
    .replace(/\s+([,.;:!?%)\]])/g, "$1")
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

/**
 * Monta apenas fatos já aprovados no preparo. Não inventa marca, GTIN ou categoria.
 *
 * Preço, estoque, tipo de anúncio, condição e garantia saem das regras que o
 * lojista respondeu em Configurações → Canais. Sem regras gravadas vale
 * `REGRAS_PADRAO`, que é exatamente o que esta função fazia antes de elas
 * existirem: preço da loja, estoque cheio, Clássico, novo, sem garantia.
 */
export function corpoDaPublicacaoMl(
  anuncio: AnuncioParaPublicar,
  base: string,
  regras: RegrasDoCanal = REGRAS_PADRAO,
): { corpo?: CorpoPublicacaoMl; erro?: string } {
  const preparo = lerPreparo(anuncio.preparo);
  if (!preparo || preparo.estado !== "PRONTO") return { erro: "O preparo do produto não está aprovado como PRONTO." };
  if (!anuncio.categoriaMl) return { erro: "Falta a categoria do Mercado Livre." };
  const impedimento = impedimentoNoCanal(
    { ativo: anuncio.produto.ativo, precoCentavos: anuncio.produto.precoCentavos, estoque: anuncio.produto.estoque },
    regras,
  );
  if (impedimento) return { erro: impedimento };

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
      price: Number((precoDoCanal(anuncio.produto.precoCentavos, regras) / 100).toFixed(2)),
      currency_id: "BRL",
      available_quantity: estoqueDoCanal(anuncio.produto.estoque, regras),
      buying_mode: "buy_it_now",
      listing_type_id: regras.tipoAnuncio === "premium" ? "gold_pro" : "gold_special",
      condition: regras.condicao === "usado" ? "used" : "new",
      channels: ["marketplace"],
      pictures,
      attributes: [...atributos].map(([id, value_name]) => ({ id, value_name })),
      ...(termosDeVenda(regras) ? { sale_terms: termosDeVenda(regras) } : {}),
    },
  };
}

export type ConteudoMl = {
  title: string;
  pictures: Array<{ source: string }>;
  /** A descrição vai em `PUT /items/{id}/description`, não no corpo do item. */
  descricao: string;
  /** Muda quando qualquer um dos três muda. É o gatilho da reescrita. */
  hash: string;
};

/**
 * O conteúdo que o anúncio deveria ter agora, a partir do catálogo da loja.
 *
 * Existe porque publicar não é o fim: o lojista troca a foto, corrige o nome,
 * reescreve a descrição — e, até aqui, só preço e estoque chegavam ao Mercado
 * Livre. O anúncio ficava com o texto do dia em que nasceu.
 *
 * A descrição do ML é texto puro e mora em endpoint próprio. HTML entra como
 * texto visível se for mandado cru, então sai daqui já limpo.
 */
export function conteudoDoAnuncio(anuncio: AnuncioParaPublicar, base: string): ConteudoMl | null {
  const preparo = lerPreparo(anuncio.preparo);
  if (!preparo) return null;
  const title = textoCurto(preparo.nomeEnriquecido, 60);
  const pictures = anuncio.produto.imagens
    .map((imagem) => imagemAbsoluta(base, imagem))
    .filter((imagem): imagem is string => Boolean(imagem))
    .slice(0, 10)
    .map((source) => ({ source }));
  // O limite do ML é 50 000 caracteres; o corte é por segurança, não por gosto.
  const descricao = textoCurto(anuncio.produto.descricao ?? anuncio.produto.descricaoCurta ?? "", 50_000);
  if (!title || !pictures.length) return null;
  const hash = createHash("sha256")
    .update(JSON.stringify({ title, pictures: pictures.map((p) => p.source), descricao }))
    .digest("hex")
    .slice(0, 16);
  return { title, pictures, descricao, hash };
}

/** O que sobrou de uma escrita de conteúdo: o que contar, e se vale tentar de novo. */
type EscritaDeConteudo = {
  avisos: string[];
  /** `true` só quando o próximo ciclo tem chance de consertar. */
  pendente: boolean;
};

/**
 * Manda o conteúdo para um anúncio que já existe.
 *
 * O ML recusa trocar o título de anúncio que já vendeu — e isso não é falha
 * do lojista nem motivo para abortar o resto: a foto e a descrição continuam
 * atualizáveis, e o motivo fica escrito no anúncio.
 *
 * E não é motivo para repetir: recusa de título em anúncio que vendeu é
 * definitiva. Se as fotos entraram, a escrita se dá por feita — insistir de
 * hora em hora gastaria duas chamadas por ciclo, para sempre, contra uma
 * resposta que não vai mudar. A pendência fica para o que o próximo ciclo
 * pode mesmo resolver: uma foto que não subiu, uma descrição recusada.
 */
async function escreverConteudo(loja: Tenant, mlbId: string, conteudo: ConteudoMl): Promise<EscritaDeConteudo> {
  const avisos: string[] = [];
  let pendente = false;
  try {
    await chamarMl(loja, `/items/${encodeURIComponent(mlbId)}`, {
      method: "PUT",
      body: JSON.stringify({ title: conteudo.title, pictures: conteudo.pictures }),
    });
  } catch (erro) {
    const mensagem = textoCurto(erro instanceof Error ? erro.message : "Falha desconhecida.", 300);
    avisos.push(`Título e fotos não foram aceitos pelo Mercado Livre: ${mensagem}`);
    try {
      await chamarMl(loja, `/items/${encodeURIComponent(mlbId)}`, { method: "PUT", body: JSON.stringify({ pictures: conteudo.pictures }) });
      avisos.push("As fotos foram atualizadas sozinhas; o título ficou como estava — anúncio com venda não troca de título.");
    } catch {
      pendente = true;
    }
  }
  if (conteudo.descricao) {
    const daDescricao = await escreverDescricao(loja, mlbId, conteudo.descricao);
    if (daDescricao.length) pendente = true;
    avisos.push(...daDescricao);
  }
  return { avisos, pendente };
}

async function escreverDescricao(loja: Tenant, mlbId: string, descricao: string): Promise<string[]> {
  try {
    await chamarMl(loja, `/items/${encodeURIComponent(mlbId)}/description`, {
      method: "PUT",
      body: JSON.stringify({ plain_text: descricao }),
    });
    return [];
  } catch (erro) {
    return [`Descrição não aceita pelo Mercado Livre: ${textoCurto(erro instanceof Error ? erro.message : "falha", 300)}`];
  }
}

async function publicarAprovados(loja: Tenant, limite: number, resumo: ResumoMercadoLivre, regras: RegrasDoCanal) {
  const regrasDoProduto = resolverRegrasDoCanal(regras);
  const anuncios = await prisma.anuncioMercadoLivre.findMany({
    where: { tenantId: loja.id, estado: "aprovado", mlbId: null, preparoEstado: "PRONTO" },
    include: { produto: true },
    orderBy: { atualizadoEm: "asc" },
    take: limite,
  });
  const base = urlDaLoja(loja);

  for (const anuncio of anuncios) {
    const doProduto = regrasDoProduto({ categoriaMl: anuncio.categoriaMl });
    const montado = corpoDaPublicacaoMl(anuncio, base, doProduto);
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
      // A descrição não vai no corpo do item: é endpoint próprio, e por isso
      // os anúncios nasciam sem descrição nenhuma. Falha aqui não desfaz o
      // anúncio — fica escrita, e o próximo ciclo tenta de novo.
      const conteudo = conteudoDoAnuncio(anuncio, base);
      const problemas = conteudo?.descricao
        ? await escreverDescricao(loja, criado.id, conteudo.descricao)
        : [];
      await prisma.anuncioMercadoLivre.update({
        where: { id: anuncio.id },
        data: {
          mlbId: criado.id,
          permalink: criado.permalink ?? null,
          statusMl: criado.status ?? "active",
          estado: "publicado",
          motivoErro: problemas.length ? problemas.join(" ") : null,
          conteudoHash: problemas.length ? null : (conteudo?.hash ?? null),
          // O que foi publicado é o preço do canal, não o da loja: com
          // acréscimo, os dois divergem, e guardar o da loja faria o ciclo
          // seguinte achar que o anúncio está desatualizado para sempre.
          precoCentavosPublicado: precoDoCanal(anuncio.produto.precoCentavos, doProduto),
          estoquePublicado: estoqueDoCanal(anuncio.produto.estoque, doProduto),
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

async function sincronizarPublicados(loja: Tenant, limite: number, resumo: ResumoMercadoLivre, regras: RegrasDoCanal) {
  const regrasDoProduto = resolverRegrasDoCanal(regras);
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

      // Conteúdo antes de preço: o lojista que corrigiu a foto errada quer ver
      // a foto certa no ar, e isso não depende de o preço ter mudado.
      const conteudo = conteudoDoAnuncio(anuncio, urlDaLoja(loja));
      const escrita: EscritaDeConteudo = conteudo && conteudo.hash !== anuncio.conteudoHash
        ? await escreverConteudo(loja, anuncio.mlbId, conteudo)
        : { avisos: [], pendente: false };

      // Preço e estoque do canal, não da loja: é o acréscimo e a reserva que
      // o lojista definiu que vão para o anúncio. Produto inativo vai a zero,
      // que é como o ML tira do ar sem fechar o anúncio.
      const doProduto = regrasDoProduto({ categoriaMl: anuncio.categoriaMl });
      const estoque = anuncio.produto.ativo ? estoqueDoCanal(anuncio.produto.estoque, doProduto) : 0;
      const precoCanalCentavos = precoDoCanal(anuncio.produto.precoCentavos, doProduto);
      const preco = Number((precoCanalCentavos / 100).toFixed(2));
      const mudouEstoque = atual.available_quantity !== estoque;
      const mudouPreco = precoCanalCentavos > 0 && atual.price !== preco;

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
      const problemas: string[] = [...escrita.avisos];
      if (confirmado.available_quantity !== estoque) problemas.push("O Mercado Livre não confirmou o novo estoque; a conta pode usar estoque multiorigem.");
      if (precoCanalCentavos > 0 && confirmado.price !== preco) problemas.push("O Mercado Livre não confirmou o novo preço; pode existir automação de preço ativa.");

      await prisma.anuncioMercadoLivre.update({
        where: { id: anuncio.id },
        data: {
          statusMl: confirmado.status ?? atual.status ?? null,
          permalink: confirmado.permalink ?? atual.permalink ?? anuncio.permalink,
          motivoErro: problemas.length ? problemas.join(" ") : null,
          precoCentavosPublicado: confirmado.price === preco ? precoCanalCentavos : anuncio.precoCentavosPublicado,
          estoquePublicado: confirmado.available_quantity === estoque ? estoque : anuncio.estoquePublicado,
          // Grava a impressão digital quando não sobrou nada que o próximo
          // ciclo possa consertar. Recusa definitiva (título de anúncio que
          // vendeu) fica só como aviso: repetir não muda a resposta.
          conteudoHash: conteudo && !escrita.pendente ? conteudo.hash : anuncio.conteudoHash,
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

/** Rotina idempotente (`mercadolivre.rodar`). Sem conexão ou aprovação, não publica. */
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
      const regras = lerRegrasDoCanal(loja.canais, "mercadolivre");
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
      // Canal desligado para de mandar coisa nova, mas continua sincronizando
      // o que já está no ar: parar o estoque de um anúncio publicado venderia
      // peça que acabou, e desligar a integração não pode custar isso ao
      // lojista. Quem tira do ar é ele, no Mercado Livre.
      if (regras.ativo) await publicarAprovados(loja, limite, resumo, regras);
      await sincronizarPublicados(loja, limite, resumo, regras);
      // Uma chamada por ciclo para saber como a conta está no canal. Falhar
      // aqui não pode derrubar publicação nem estoque, que são o essencial.
      try {
        const reputacao = await atualizarReputacaoMl(loja);
        if (reputacao?.alertas.length) {
          resumo.detalhes.push({ loja: loja.slug, etapa: "reputacao", resultado: reputacao.alertas.join(" ") });
        }
      } catch (erro) {
        resumo.detalhes.push({ loja: loja.slug, etapa: "reputacao", resultado: textoCurto(erro instanceof Error ? erro.message : "falha", 300) });
      }
    } catch (erro) {
      const mensagem = textoCurto(erro instanceof MercadoLivreNaoConectado || erro instanceof Error ? erro.message : "Falha desconhecida.", 1000);
      resumo.falhas++;
      resumo.detalhes.push({ loja: loja.slug, etapa: "loja", resultado: mensagem });
    }
  }
  return resumo;
}
