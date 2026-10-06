import assert from "node:assert/strict";
import test from "node:test";
import { pixelsDaPlataforma, temRastreio } from "./pixels";

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
