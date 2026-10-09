import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Pixels from "../components/Pixels";
import { scriptInicialDoGoogle, type PixelsDaLoja } from "./pixels";

// A ordem que `eventos-loja.test.ts` supõe (script em linha já executado quando
// o `view_item` dispara na hidratação) depende de onde cada script nasce: o do
// `consent default` sai no HTML do servidor; os loaders são `next/script`
// `afterInteractive`, que não escreve `<script>` no HTML e só entra pelo
// navegador depois da hidratação. Aqui se confere o HTML renderizado, com o
// `react-dom/server` e fora do Next: não é teste de navegador.

const SEM_PIXEL: PixelsDaLoja = { gtmId: null, ga4Id: null, googleAdsId: null, metaPixelId: null, tiktokPixelId: null, googleMerchantId: null };
const TODOS: PixelsDaLoja = { gtmId: "GTM-ABC123", ga4Id: "G-ABCD123456", googleAdsId: "AW-123456789", metaPixelId: "1234567890", tiktokPixelId: "C4A1B2C3D4E5F6G7H8I9", googleMerchantId: null };

const htmlDe = (p: PixelsDaLoja) => renderToStaticMarkup(createElement(Pixels, { p }));
const LOADERS = ["googletagmanager.com", "gtm.js", "gtag/js", "fbevents.js", "analytics.tiktok.com", "fbq(", "ttq."];

const COM_GOOGLE: [string, PixelsDaLoja][] = [
  ["GTM e gtag", TODOS],
  ["só GTM", { ...SEM_PIXEL, gtmId: "GTM-ABC123" }],
  ["só GA4", { ...SEM_PIXEL, ga4Id: "G-ABCD123456" }],
  ["só Google Ads", { ...SEM_PIXEL, googleAdsId: "AW-123456789" }],
];

for (const [nome, p] of COM_GOOGLE) {
  test(`HTML do servidor com ${nome}: o script em linha é o primeiro script e nenhum loader vem antes dele`, () => {
    const html = htmlDe(p);
    const emLinha = `<script>${scriptInicialDoGoogle(p)}</script>`;
    assert.equal(html.indexOf("<script"), html.indexOf(emLinha), "o primeiro <script> do HTML é o do consent default");
    assert.notEqual(html.indexOf(emLinha), -1);
    const antes = html.slice(0, html.indexOf(emLinha));
    for (const loader of LOADERS) assert.equal(antes.includes(loader), false, `${loader} antes do script em linha`);
    // Nenhum loader executável no HTML: `afterInteractive` fica para o navegador.
    assert.equal(html.split("<script").length - 1, 1, "só o script em linha é <script> no HTML");
  });
}

test("HTML do servidor sem Google não traz script nenhum, nem com Meta e TikTok preenchidos", () => {
  assert.equal(htmlDe(SEM_PIXEL).includes("<script"), false);
  // Sem aceite de cookies (no servidor ninguém aceitou) Meta e TikTok não são inseridos.
  const html = htmlDe({ ...SEM_PIXEL, metaPixelId: "1234567890", tiktokPixelId: "C4A1B2C3D4E5F6G7H8I9" });
  assert.equal(html.includes("<script"), false);
  for (const loader of LOADERS) assert.equal(html.includes(loader), false, loader);
});
