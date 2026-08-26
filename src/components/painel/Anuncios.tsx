"use client";

import { useState } from "react";
import { Campo, Secao, inputClasse } from "./campos";

export interface PixelsView {
  gtmId: string | null;
  metaPixelId: string | null;
  ga4Id: string | null;
  googleAdsId: string | null;
  googleAdsRotuloCompra: string | null;
  tiktokPixelId: string | null;
}

/**
 * Aba "Anúncios": o lojista cola os ids e a loja passa a mandar os eventos de
 * e-commerce sozinha. Sem id, nenhum script é carregado — loja que não anuncia
 * não carrega peso nem cookie de rastreio.
 */
export default function Anuncios({ pixels, chamar, ocupado }: { pixels: PixelsView; chamar: (c: string, m: string, b?: unknown, s?: string) => Promise<unknown>; ocupado: boolean }) {
  const [f, setF] = useState({
    metaPixelId: pixels.metaPixelId ?? "",
    ga4Id: pixels.ga4Id ?? "",
    googleAdsId: pixels.googleAdsId ?? "",
    googleAdsRotuloCompra: pixels.googleAdsRotuloCompra ?? "",
    tiktokPixelId: pixels.tiktokPixelId ?? "",
    gtmId: pixels.gtmId ?? "",
  });
  const set = (k: keyof typeof f, v: string) => setF({ ...f, [k]: v.trim() });
  const algum = Object.values(f).some(Boolean);

  return (
    <>
      <Secao titulo="Pixels de anúncio" descricao="Cole os identificadores das plataformas onde você anuncia. A loja dispara sozinha os eventos que o anúncio precisa para otimizar por venda.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Meta (Facebook/Instagram)" ajuda="Gerenciador de Eventos → Fontes de dados. Só os números.">
            <input className={inputClasse} value={f.metaPixelId} onChange={(e) => set("metaPixelId", e.target.value)} placeholder="1234567890123456" inputMode="numeric" />
          </Campo>
          <Campo label="Google Analytics 4" ajuda="Admin → Fluxos de dados. Começa com G-">
            <input className={inputClasse} value={f.ga4Id} onChange={(e) => set("ga4Id", e.target.value)} placeholder="G-XXXXXXXXXX" />
          </Campo>
          <Campo label="Google Ads" ajuda="Ferramentas → Conversões. Começa com AW-">
            <input className={inputClasse} value={f.googleAdsId} onChange={(e) => set("googleAdsId", e.target.value)} placeholder="AW-123456789" />
          </Campo>
          <Campo label="Rótulo da conversão de compra" ajuda="Sem ele o Google Ads não conta a venda. Fica junto do AW- na tela de conversões.">
            <input className={inputClasse} value={f.googleAdsRotuloCompra} onChange={(e) => set("googleAdsRotuloCompra", e.target.value)} placeholder="AbC-D_efGhIjKlMnOp" />
          </Campo>
          <Campo label="TikTok" ajuda="Gerenciador de Eventos do TikTok Ads.">
            <input className={inputClasse} value={f.tiktokPixelId} onChange={(e) => set("tiktokPixelId", e.target.value)} placeholder="CXXXXXXXXXXXXXXXXXX" />
          </Campo>
          <Campo label="Google Tag Manager" ajuda="Opcional, para quem já usa GTM.">
            <input className={inputClasse} value={f.gtmId} onChange={(e) => set("gtmId", e.target.value)} placeholder="GTM-XXXXXXX" />
          </Campo>
        </div>
        <div>
          <button className="btn-primario" disabled={ocupado} onClick={() => chamar("/api/painel/loja", "PATCH", Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v || null])), "Pixels salvos.")}>Salvar</button>
        </div>
      </Secao>

      <Secao titulo="O que a loja envia automaticamente" descricao={algum ? "Os eventos abaixo já estão ativos nos pixels que você preencheu." : "Assim que você salvar um pixel, estes eventos passam a ser enviados."}>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground"><tr><th className="py-2">Quando</th><th>Google</th><th>Meta</th><th>TikTok</th></tr></thead>
          <tbody>
            {[
              ["Abre um produto", "view_item", "ViewContent", "ViewContent"],
              ["Adiciona ao carrinho", "add_to_cart", "AddToCart", "AddToCart"],
              ["Começa o checkout", "begin_checkout", "InitiateCheckout", "InitiateCheckout"],
              ["Pedido pago", "purchase", "Purchase", "CompletePayment"],
            ].map(([quando, ...resto]) => (
              <tr key={quando} className="border-t border-border">
                <td className="py-2">{quando}</td>
                {resto.map((e) => <td key={e}><code className="text-xs">{e}</code></td>)}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="text-xs text-muted-foreground">Valores em BRL, com id, nome e quantidade de cada item. A compra é contada uma vez só, mesmo que a pessoa recarregue a página do pedido.</p>
      </Secao>
    </>
  );
}
