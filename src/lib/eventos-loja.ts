"use client";

import type { EventoFunil } from "./funil-analytics";
import { lerConsentimentoAtual } from "./consentimento";
import { permissoesDaEscolha } from "./consentimento-config";

/**
 * Eventos de e-commerce disparados no navegador do comprador.
 *
 * Um evento, três destinos: GA4/Google Ads (`gtag`/`dataLayer`), Meta (`fbq`)
 * e TikTok (`ttq`). Se o pixel não existir na página, a chamada simplesmente
 * não acontece — nada quebra em loja sem anúncio.
 *
 * Os nomes são os canônicos de cada plataforma, porque é assim que o
 * Gerenciador de Anúncios reconhece a conversão sem configuração manual.
 */
export interface ItemEvento {
  id: string;
  nome: string;
  precoCentavos: number;
  quantidade?: number;
  categoria?: string | null;
  marca?: string | null;
  variante?: string | null;
  emEstoque?: boolean;
  descontoUnitarioCentavos?: number;
  cupomCodigo?: string | null;
}

type Janela = Window & {
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
  ttq?: { track: (evento: string, dados?: unknown) => void };
  dataLayer?: unknown[];
  /** Gravado por Pixels.tsx no HTML, antes de qualquer evento: a loja usa GTM? */
  __lojaPixels?: { gtm?: boolean };
};

const reais = (centavos: number) => Number((centavos / 100).toFixed(2));
const reaisPorUnidade = (centavos: number) => Number((centavos / 100).toFixed(Number.isInteger(centavos) ? 2 : 12));

function janela(): Janela | null {
  return typeof window === "undefined" ? null : (window as Janela);
}

const esperar = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Envio first-party. 202 significa que a criação da sessão ainda está em voo. */
export async function enviarEventoFunil(
  event: EventoFunil,
  buscar: typeof fetch = fetch,
  aguardar: (ms: number) => Promise<void> = esperar,
) {
  const enviar = () => buscar("/api/vitrine/evento", {
    method: "POST",
    headers: { "content-type": "application/json" },
    keepalive: true,
    body: JSON.stringify({ event }),
  });
  const primeira = await enviar();
  if (primeira.status === 202) {
    await aguardar(350);
    await enviar();
  }
}

export function registrarEventoFunil(evento: EventoFunil) {
  const w = janela();
  if (!w || typeof w.fetch !== "function") return;
  void enviarEventoFunil(evento, w.fetch.bind(w)).catch(() => {});
}

export function paraGa4(itens: ItemEvento[]) {
  return itens.map((i) => ({
    item_id: i.id,
    item_name: i.nome,
    price: reaisPorUnidade(i.precoCentavos - (i.descontoUnitarioCentavos ?? 0)),
    quantity: i.quantidade ?? 1,
    item_category: i.categoria ?? undefined,
    ...(i.marca ? { item_brand: i.marca } : {}),
    ...(i.variante ? { item_variant: i.variante } : {}),
    ...(typeof i.emEstoque === "boolean" ? { in_stock: i.emEstoque } : {}),
    ...(i.descontoUnitarioCentavos ? { discount: reaisPorUnidade(i.descontoUnitarioCentavos) } : {}),
    ...(i.cupomCodigo ? { coupon: i.cupomCodigo } : {}),
  }));
}

/** Rateia o desconto da compra sem alterar os preços comerciais recebidos. */
function itensDaCompra(itens: ItemEvento[], descontoCentavos: number, cupom?: string | null): ItemEvento[] {
  const linhas = itens.map((item, indice) => {
    const quantidade = item.quantidade ?? 1;
    return { item, indice, quantidade, total: item.precoCentavos * quantidade, porUnidade: 0, unidadesComCentavoExtra: 0, resto: 0n };
  });
  const subtotal = linhas.reduce((soma, linha) => soma + linha.total, 0);
  if (!Number.isSafeInteger(subtotal) || subtotal <= 0 || !Number.isFinite(descontoCentavos)
    || linhas.some((linha) => !Number.isSafeInteger(linha.item.precoCentavos) || !Number.isSafeInteger(linha.total) || linha.total < 0 || !Number.isSafeInteger(linha.quantidade) || linha.quantidade < 1)) return itens;
  const desconto = Math.min(subtotal, Math.max(0, Math.trunc(descontoCentavos)));
  if (!desconto) return itens;

  const base = BigInt(subtotal);
  for (const linha of linhas) {
    const numerador = BigInt(desconto) * BigInt(linha.item.precoCentavos);
    linha.porUnidade = Number(numerador / base);
    linha.resto = numerador % base;
  }
  let sobram = desconto - linhas.reduce((soma, linha) => soma + linha.porUnidade * linha.quantidade, 0);
  const prioridade = [...linhas].sort((a, b) => a.resto === b.resto ? a.indice - b.indice : a.resto > b.resto ? -1 : 1);
  for (const linha of prioridade) {
    linha.unidadesComCentavoExtra = Math.min(sobram, linha.quantidade);
    sobram -= linha.unidadesComCentavoExtra;
    if (!sobram) break;
  }

  return linhas.flatMap(({ item, quantidade, porUnidade, unidadesComCentavoExtra }) => {
    const grupo = (unidades: number, descontoUnitario: number): ItemEvento => ({
      ...item, quantidade: unidades, descontoUnitarioCentavos: descontoUnitario,
      ...(cupom && descontoUnitario > 0 ? { cupomCodigo: cupom } : {}),
    });
    // O rateio por unidade produz no máximo um grupo parcial. Até 199 linhas,
    // ele vira dois grupos do mesmo SKU, com preços exatos em centavos.
    // No limite do GA4, preservamos a linha usando precisão unitária adicional.
    // Pedidos que já excediam 200 linhas continuam sujeitos ao limite do Google.
    if (itens.length >= 200 && unidadesComCentavoExtra > 0 && unidadesComCentavoExtra < quantidade) {
      return [grupo(quantidade, porUnidade + unidadesComCentavoExtra / quantidade)];
    }
    return [
      ...(quantidade > unidadesComCentavoExtra ? [grupo(quantidade - unidadesComCentavoExtra, porUnidade)] : []),
      ...(unidadesComCentavoExtra ? [grupo(unidadesComCentavoExtra, porUnidade + 1)] : []),
    ];
  });
}

/**
 * O que vai para o Tag Manager.
 *
 * `gtag('event', …)` empurra um objeto `arguments` no dataLayer, que só o
 * gtag.js entende. Um gatilho do GTM ("Evento personalizado: add_to_cart") lê
 * o dataLayer procurando `{ event: "add_to_cart", ecommerce: {...} }`, que é
 * o formato de e-commerce do GA4. Sem isto, a loja com GTM e sem GA4 direto
 * tinha os eventos na tabela do painel e nenhum deles chegava ao contêiner.
 *
 * `ecommerce: null` antes de cada evento é a recomendação do Google: sem ele,
 * o GTM mescla os itens do evento anterior nos do próximo.
 */
export function entradasDoDataLayer(evento: string, itens: ItemEvento[], valorCentavos: number, extra: { transacao?: string; frete?: number; cupom?: string | null } = {}): unknown[] {
  return [
    { ecommerce: null },
    {
      event: evento,
      ecommerce: {
        currency: "BRL",
        value: reais(valorCentavos),
        ...(extra.transacao ? { transaction_id: extra.transacao } : {}),
        ...(extra.frete != null ? { shipping: reais(extra.frete) } : {}),
        ...(extra.cupom ? { coupon: extra.cupom } : {}),
        items: paraGa4(itens),
      },
    },
  ];
}

function disparar(nomes: { ga4: string; meta: string; tiktok: string }, itens: ItemEvento[], extra: { valor?: number; transacao?: string; frete?: number; cupom?: string | null } = {}) {
  const w = janela();
  if (!w) return;
  const valor = extra.valor ?? itens.reduce((s, i) => s + i.precoCentavos * (i.quantidade ?? 1), 0);

  try {
    // Um caminho só para o Google. Com GTM, o evento vai como objeto no
    // dataLayer e o contêiner decide o que fazer com ele; chamar `gtag('event')`
    // junto faria o mesmo gatilho disparar duas vezes. Sem GTM, o gtag.js do
    // GA4/Ads é quem lê, e ele só entende a chamada `gtag`.
    if (w.__lojaPixels?.gtm) {
      // O dataLayer existe desde o HTML (Pixels.tsx); isto é só rede de proteção.
      (w.dataLayer ??= []);
      for (const entrada of entradasDoDataLayer(nomes.ga4, itens, valor, { transacao: extra.transacao, frete: extra.frete, cupom: extra.cupom })) w.dataLayer.push(entrada);
    } else {
      w.gtag?.("event", nomes.ga4, {
        currency: "BRL",
        value: reais(valor),
        items: paraGa4(itens),
        ...(extra.transacao ? { transaction_id: extra.transacao } : {}),
        ...(extra.frete != null ? { shipping: reais(extra.frete) } : {}),
        ...(extra.cupom ? { coupon: extra.cupom } : {}),
      });
    }
    if (!permissoesDaEscolha(lerConsentimentoAtual()).publicidade) return;
    w.fbq?.("track", nomes.meta, {
      currency: "BRL",
      value: reais(valor),
      content_type: "product",
      content_ids: itens.map((i) => i.id),
      contents: itens.map((i) => ({ id: i.id, quantity: i.quantidade ?? 1, item_price: reaisPorUnidade(i.precoCentavos - (i.descontoUnitarioCentavos ?? 0)) })),
    });
    w.ttq?.track(nomes.tiktok, {
      currency: "BRL",
      value: reais(valor),
      contents: itens.map((i) => ({ content_id: i.id, content_name: i.nome, quantity: i.quantidade ?? 1, price: reaisPorUnidade(i.precoCentavos - (i.descontoUnitarioCentavos ?? 0)) })),
    });
  } catch {
    /* pixel com problema nunca pode atrapalhar a compra */
  }
}

export const verProduto = (item: ItemEvento) => { registrarEventoFunil("view_item"); disparar({ ga4: "view_item", meta: "ViewContent", tiktok: "ViewContent" }, [item]); };
export const adicionarAoCarrinho = (item: ItemEvento) => { registrarEventoFunil("add_to_cart"); disparar({ ga4: "add_to_cart", meta: "AddToCart", tiktok: "AddToCart" }, [item]); };
export const iniciarCheckout = (itens: ItemEvento[]) => { registrarEventoFunil("begin_checkout"); disparar({ ga4: "begin_checkout", meta: "InitiateCheckout", tiktok: "InitiateCheckout" }, itens); };

/**
 * O `value` da compra é a receita dos itens, com desconto, sem frete: é o que
 * a referência do GA4 pede para `purchase` (o frete vai em `shipping`), e o
 * total cobrado inflava a receita de toda venda com frete pago.
 */
export function receitaDosItens(totalCentavos: number, freteCentavos: number): number {
  return Math.max(0, totalCentavos - Math.max(0, freteCentavos));
}

/** Compra concluída — o evento que o anúncio otimiza. Roda uma vez por pedido. */
export function comprar(itens: ItemEvento[], dados: { totalCentavos: number; freteCentavos: number; referencia: string; descontoCentavos?: number; cupomCodigo?: string | null; googleAdsId?: string | null; rotuloCompra?: string | null }) {
  const marca = `compra:${dados.referencia}`;
  try {
    if (window.sessionStorage.getItem(marca)) return; // recarregar a página não conta duas vendas
    window.sessionStorage.setItem(marca, "1");
  } catch {
    /* storage bloqueado: segue e aceita o risco de contar de novo */
  }
  const receita = receitaDosItens(dados.totalCentavos, dados.freteCentavos);
  const subtotal = itens.reduce((soma, item) => soma + item.precoCentavos * (item.quantidade ?? 1), 0);
  const desconto = dados.descontoCentavos ?? Math.max(0, subtotal - receita);
  disparar({ ga4: "purchase", meta: "Purchase", tiktok: "CompletePayment" }, itensDaCompra(itens, desconto, dados.cupomCodigo), {
    valor: receita,
    transacao: dados.referencia,
    frete: dados.freteCentavos,
    cupom: dados.cupomCodigo,
  });
  // Conversão do Google Ads: exige o rótulo, não basta o id da conta. Com GTM
  // ela é tag do contêiner, lida do `purchase` no dataLayer; chamar `gtag`
  // junto contaria a mesma venda duas vezes (um caminho só para o Google).
  if (dados.googleAdsId && dados.rotuloCompra && !janela()?.__lojaPixels?.gtm) {
    janela()?.gtag?.("event", "conversion", {
      send_to: `${dados.googleAdsId}/${dados.rotuloCompra}`,
      value: reais(receita),
      currency: "BRL",
      transaction_id: dados.referencia,
    });
  }
}
