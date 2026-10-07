"use client";

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
}

type Janela = Window & {
  gtag?: (...args: unknown[]) => void;
  fbq?: (...args: unknown[]) => void;
  ttq?: { track: (evento: string, dados?: unknown) => void };
  dataLayer?: unknown[];
};

const reais = (centavos: number) => Number((centavos / 100).toFixed(2));

function janela(): Janela | null {
  return typeof window === "undefined" ? null : (window as Janela);
}

function paraGa4(itens: ItemEvento[]) {
  return itens.map((i) => ({ item_id: i.id, item_name: i.nome, price: reais(i.precoCentavos), quantity: i.quantidade ?? 1, item_category: i.categoria ?? undefined }));
}

/**
 * Para onde os eventos vão, dito pelo componente `Pixels` ao montar.
 *
 * `gtag('event', …)` empurra um objeto `arguments` para o `dataLayer`, e o Tag
 * Manager não transforma isso em gatilho: a tag do GA4 dentro do container lê
 * `{ event, ecommerce }`. Loja que só colou o GTM (a PK Vedações, em
 * 07/10/2026) tinha view_item, add_to_cart e purchase disparando para
 * ninguém. Quando o gtag está configurado (GA4 ou Google Ads direto), o GA4
 * já recebe por ele, e mandar também pelo dataLayer contaria a venda duas
 * vezes num container que tenha a tag do GA4.
 */
let destinos = { gtm: false, gtag: false };
export function configurarDestinos(d: { gtm: boolean; gtag: boolean }) {
  destinos = d;
}

type ExtraEvento = { valor?: number; transacao?: string; frete?: number };

/** O mesmo evento no formato que o Tag Manager lê: `event` + `ecommerce`. */
export function cargaGtm(nome: string, itens: ItemEvento[], extra: ExtraEvento = {}) {
  const valor = extra.valor ?? itens.reduce((s, i) => s + i.precoCentavos * (i.quantidade ?? 1), 0);
  return {
    event: nome,
    ecommerce: {
      currency: "BRL",
      value: reais(valor),
      items: paraGa4(itens),
      ...(extra.transacao ? { transaction_id: extra.transacao } : {}),
      ...(extra.frete != null ? { shipping: reais(extra.frete) } : {}),
    },
  };
}

function disparar(nomes: { ga4: string; meta: string; tiktok: string }, itens: ItemEvento[], extra: ExtraEvento = {}) {
  const w = janela();
  if (!w) return;
  const valor = extra.valor ?? itens.reduce((s, i) => s + i.precoCentavos * (i.quantidade ?? 1), 0);

  try {
    if (destinos.gtm && !destinos.gtag) {
      w.dataLayer = w.dataLayer ?? [];
      // Limpar o `ecommerce` anterior é o que o Google recomenda, para a tag
      // não reaproveitar os itens do evento passado.
      w.dataLayer.push({ ecommerce: null });
      w.dataLayer.push(cargaGtm(nomes.ga4, itens, extra));
    }
    w.gtag?.("event", nomes.ga4, {
      currency: "BRL",
      value: reais(valor),
      items: paraGa4(itens),
      ...(extra.transacao ? { transaction_id: extra.transacao } : {}),
      ...(extra.frete != null ? { shipping: reais(extra.frete) } : {}),
    });
    w.fbq?.("track", nomes.meta, {
      currency: "BRL",
      value: reais(valor),
      content_type: "product",
      content_ids: itens.map((i) => i.id),
      contents: itens.map((i) => ({ id: i.id, quantity: i.quantidade ?? 1, item_price: reais(i.precoCentavos) })),
    });
    w.ttq?.track(nomes.tiktok, {
      currency: "BRL",
      value: reais(valor),
      contents: itens.map((i) => ({ content_id: i.id, content_name: i.nome, quantity: i.quantidade ?? 1, price: reais(i.precoCentavos) })),
    });
  } catch {
    /* pixel com problema nunca pode atrapalhar a compra */
  }
}

export const verProduto = (item: ItemEvento) => disparar({ ga4: "view_item", meta: "ViewContent", tiktok: "ViewContent" }, [item]);
export const adicionarAoCarrinho = (item: ItemEvento) => disparar({ ga4: "add_to_cart", meta: "AddToCart", tiktok: "AddToCart" }, [item]);
export const iniciarCheckout = (itens: ItemEvento[]) => disparar({ ga4: "begin_checkout", meta: "InitiateCheckout", tiktok: "InitiateCheckout" }, itens);

/** Compra concluída — o evento que o anúncio otimiza. Roda uma vez por pedido. */
export function comprar(itens: ItemEvento[], dados: { totalCentavos: number; freteCentavos: number; referencia: string; googleAdsId?: string | null; rotuloCompra?: string | null }) {
  const marca = `compra:${dados.referencia}`;
  try {
    if (window.sessionStorage.getItem(marca)) return; // recarregar a página não conta duas vendas
    window.sessionStorage.setItem(marca, "1");
  } catch {
    /* storage bloqueado: segue e aceita o risco de contar de novo */
  }
  disparar({ ga4: "purchase", meta: "Purchase", tiktok: "CompletePayment" }, itens, {
    valor: dados.totalCentavos,
    transacao: dados.referencia,
    frete: dados.freteCentavos,
  });
  // Conversão do Google Ads: exige o rótulo, não basta o id da conta.
  if (dados.googleAdsId && dados.rotuloCompra) {
    janela()?.gtag?.("event", "conversion", {
      send_to: `${dados.googleAdsId}/${dados.rotuloCompra}`,
      value: reais(dados.totalCentavos),
      currency: "BRL",
      transaction_id: dados.referencia,
    });
  }
}
