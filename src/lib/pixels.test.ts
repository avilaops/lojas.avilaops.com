import assert from "node:assert/strict";
import test from "node:test";
import { caminhoDoGatewayGoogle, pixelsDaPlataforma, temRastreio } from "./pixels";

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
  for (const host of ["avilaops.com", "brilhax.com", "lojas.avilaops.com.example.org", "fake-lojas.avilaops.com", ""]) {
    assert.equal(caminhoDoGatewayGoogle(host, env), null, host);
  }
});

test("Gateway não aceita origem externa, query ou caminho sobreposto ao aplicativo", () => {
  for (const path of ["", "/", "https://evil.test", "//evil.test", "/avmetrics?foo=1", "/foo/bar"]) {
    assert.equal(caminhoDoGatewayGoogle("demo.lojas.avilaops.com", { GOOGLE_TAG_GATEWAY_LOJAS_PATH: path }), null, path);
  }
});
