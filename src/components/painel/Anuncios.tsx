"use client";

import { useState } from "react";
import type { DiagnosticoFeed } from "@/lib/catalogo";
import { Campo, Secao, inputClasse } from "./campos";

export interface PixelsView {
  gtmId: string | null;
  metaPixelId: string | null;
  ga4Id: string | null;
  googleAdsId: string | null;
  googleAdsRotuloCompra: string | null;
  tiktokPixelId: string | null;
  googleMerchantId: string | null;
  googleSeloAvaliacoes: boolean;
}

/**
 * Aba "Anúncios": o lojista cola os ids e a loja passa a mandar os eventos de
 * e-commerce sozinha. Sem id, nenhum script é carregado — loja que não anuncia
 * não carrega peso nem cookie de rastreio.
 */
export default function Anuncios({ pixels, catalogo, feedUrl, chamar, ocupado }: { pixels: PixelsView; catalogo: DiagnosticoFeed; feedUrl: string; chamar: (c: string, m: string, b?: unknown, s?: string) => Promise<unknown>; ocupado: boolean }) {
  const [copiado, setCopiado] = useState(false);
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
  const [merchantId, setMerchantId] = useState(pixels.googleMerchantId ?? "");
  const [selo, setSelo] = useState(pixels.googleSeloAvaliacoes);

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
          <Campo label="Google Tag Manager" ajuda="Opcional, para quem já usa GTM. Os eventos chegam no dataLayer no formato do GA4 (event + ecommerce). Se o GA4 e o Google Ads já estão dentro do contêiner, deixe os dois campos acima vazios, senão cada venda conta duas vezes.">
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

      <Secao titulo="Catálogo para anúncios" descricao="Um endereço só, aceito pelo Google Merchant Center, pelo Meta Commerce Manager (Facebook e Instagram) e pelo TikTok. Cadastre uma vez: ele se atualiza sozinho a cada 15 minutos.">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input className={`${inputClasse} font-mono text-xs`} value={feedUrl} readOnly onFocus={(e) => e.currentTarget.select()} />
          <button
            className="btn-secundario"
            onClick={() => {
              navigator.clipboard?.writeText(feedUrl).then(() => {
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              });
            }}
          >
            {copiado ? "Copiado" : "Copiar"}
          </button>
        </div>

        <p className="text-sm">
          <b>{catalogo.prontos}</b> de <b>{catalogo.total}</b> produtos ativos entram no catálogo.
          {catalogo.prontos < catalogo.total && " Os demais são recusados por falta de informação obrigatória."}
        </p>

        {catalogo.problemas.length > 0 && (
          <ul className="grid gap-1 text-sm">
            {catalogo.problemas.map((p) => (
              <li key={p.nome} className="flex flex-wrap items-baseline gap-x-2 border-t border-border py-1.5">
                <span className="flex-1 truncate">{p.nome}</span>
                {p.bloqueios.map((b) => (
                  <span key={b} className="rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-800">falta {b}</span>
                ))}
                {p.avisos.map((a) => (
                  <span key={a} className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-900">sem {a}</span>
                ))}
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-muted-foreground">
          Vermelho barra o produto no catálogo. Amarelo não barra, mas anúncio sem marca e sem código de barras aparece menos e disputa preço com quem tem.
        </p>
      </Secao>

      <Secao titulo="Google Merchant Center" descricao="Com o número da conta, a loja convida quem comprou a avaliar depois da entrega (Google Avaliações do Consumidor). É o que forma a nota de vendedor que aparece nos anúncios e na busca.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="ID do Merchant Center" ajuda="O número que aparece embaixo do nome da loja, no canto superior do Merchant Center. Só os dígitos.">
            <input className={inputClasse} value={merchantId} onChange={(e) => setMerchantId(e.target.value.replace(/\D/g, ""))} placeholder="1234567890" inputMode="numeric" />
          </Campo>
          <label className="flex items-start gap-2 text-sm sm:pt-6">
            <input type="checkbox" className="mt-1" checked={selo} disabled={!merchantId} onChange={(e) => setSelo(e.target.checked)} />
            <span>Mostrar o selo com a nota na loja. Enquanto não houver avaliações, o selo diz que não há classificação.</span>
          </label>
        </div>
        <div>
          <button className="btn-primario" disabled={ocupado} onClick={() => chamar("/api/painel/loja", "PATCH", { googleMerchantId: merchantId || null, googleSeloAvaliacoes: Boolean(merchantId) && selo }, "Merchant Center salvo.")}>Salvar</button>
        </div>
        <ol className="grid list-decimal gap-1 pl-5 text-sm text-muted-foreground">
          <li>No Merchant Center, cadastre o endereço do catálogo acima como fonte de dados de produtos.</li>
          <li>Em Entregas e devoluções, crie a política de devolução com o prazo e o custo que a loja publica em Políticas.</li>
          <li>Em Qualidade da loja, ative o Google Avaliações do Consumidor. O convite só aparece para quem aceitou os cookies e em pedido pago.</li>
        </ol>
      </Secao>
    </>
  );
}
