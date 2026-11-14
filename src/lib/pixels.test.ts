import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { caminhoDoGatewayGoogle, pixelsDaPlataforma, scriptDoGtm, temRastreio } from "./pixels";

test("site da plataforma só carrega tag com um id de GTM bem formado", () => {
  assert.equal(pixelsDaPlataforma({}).gtmId, null);
  assert.equal(temRastreio(pixelsDaPlataforma({})), false, "sem id não há aviso de cookies");
  for (const ruim of ["", "  ", "G-ABC123", "gtm-abc123", "GTM-", "GTM-ABC');alert(1)//", "<script>"]) {
    assert.equal(pixelsDaPlataforma({ PLATAFORMA_GTM_ID: ruim }).gtmId, null, ruim);
  }
  const p = pixelsDaPlataforma({ PLATAFORMA_GTM_ID: " GTM-PFBBR3GG " });
  assert.equal(p.gtmId, "GTM-PFBBR3GG");
  assert.equal(temRastreio(p), true);
});

test("a plataforma não herda pixel de anúncio nem selo de loja nenhuma", () => {
  const p = pixelsDaPlataforma({ PLATAFORMA_GTM_ID: "GTM-PFBBR3GG" });
  assert.deepEqual({ ...p, gtmId: null }, { gtmId: null, metaPixelId: null, ga4Id: null, googleAdsId: null, tiktokPixelId: null, googleMerchantId: null });
});

test("Gateway da plataforma é opt-in e só atende aos hostnames da sua zona de lojas", () => {
  const env = { GOOGLE_TAG_GATEWAY_LOJAS_PATH: "/avmetrics" };
  assert.equal(caminhoDoGatewayGoogle("lojas.avilaops.com", {}), null);
  for (const host of ["lojas.avilaops.com", "demo.lojas.avilaops.com", "bereta-rodas.lojas.avilaops.com"]) {
    assert.equal(caminhoDoGatewayGoogle(host, env), "/avmetrics/", host);
  }
  assert.equal(caminhoDoGatewayGoogle("DEMO.LOJAS.AVILAOPS.COM:443", env), "/avmetrics/");
  for (const host of ["avilaops.com", "brilhax.com", "lojas.avilaops.com.example.org", "fake-lojas.avilaops.com", ""]) {
    assert.equal(caminhoDoGatewayGoogle(host, env), null, host);
  }
});

test("loader do GTM usa o contêiner próprio tanto no Gateway quanto no carregamento direto", () => {
  for (const gateway of [undefined, "/avmetrics/"]) {
    const scripts: { src?: string; async?: boolean }[] = [];
    const window = { dataLayer: [] as { event: string }[] };
    const document = {
      getElementsByTagName: () => [{ parentNode: { insertBefore: (script: { src: string }) => scripts.push(script) } }],
      createElement: () => ({}),
    };
    runInNewContext(scriptDoGtm({ gtmId: "GTM-N7LPC7T9", googleTagGatewayPath: gateway }), { window, document });
    assert.equal(scripts.length, 1);
    assert.equal(scripts[0].async, true);
    assert.equal(scripts[0].src, `${gateway ?? "https://www.googletagmanager.com/gtm.js"}?id=GTM-N7LPC7T9`);
    assert.equal(window.dataLayer[0].event, "gtm.js");
  }
  const plataforma = pixelsDaPlataforma({ PLATAFORMA_GTM_ID: "GTM-PFBBR3GG", GOOGLE_TAG_GATEWAY_LOJAS_PATH: "/avmetrics" });
  assert.equal(plataforma.googleTagGatewayPath, "/avmetrics/");
  assert.match(scriptDoGtm(plataforma), /GTM-PFBBR3GG/);
});

test("Gateway não aceita origem externa, query ou caminho sobreposto ao aplicativo", () => {
  for (const path of ["", "/", "https://evil.test", "//evil.test", "/avmetrics?foo=1", "/foo/bar"]) {
    assert.equal(caminhoDoGatewayGoogle("demo.lojas.avilaops.com", { GOOGLE_TAG_GATEWAY_LOJAS_PATH: path }), null, path);
  }
});
