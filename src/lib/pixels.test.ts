import assert from "node:assert/strict";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { caminhoDoGatewayGoogle, pixelsDaPlataforma, scriptDoGtm, scriptInicialDoGoogle, temRastreio } from "./pixels";
import { CHAVE, VERSAO } from "./consentimento";

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

function consentimentoInicial(ler: (chave: string) => string | null) {
  const contexto = { dataLayer: [] as unknown[], localStorage: { getItem: ler } };
  runInNewContext(scriptInicialDoGoogle({ gtmId: "GTM-ABC123" }), { ...contexto, window: contexto });
  return contexto.dataLayer.map((x) => Array.from(x as ArrayLike<unknown>))
    .filter((x) => x[0] === "consent") as [string, string, Record<string, string>][];
}

test("escolha aceita e vigente é restaurada antes dos loaders, preservando default negado como primeiro comando", () => {
  const comandos = consentimentoInicial((chave) => {
    assert.equal(chave, CHAVE);
    return JSON.stringify({ versao: VERSAO, escolha: "aceito" });
  });
  assert.equal(comandos[0][1], "default");
  assert.equal(comandos[0][2].analytics_storage, "denied");
  for (const categoria of ["analytics_storage", "ad_storage", "ad_user_data", "ad_personalization"]) {
    assert.equal(comandos.at(-1)?.[2][categoria], "granted", categoria);
  }
});

test("escolha essencial, inválida ou vencida e storage bloqueado mantêm o estado negado", () => {
  for (const valor of [null, "{", JSON.stringify({ versao: VERSAO, escolha: "essencial" }), JSON.stringify({ versao: 0, escolha: "aceito" }), JSON.stringify({ versao: VERSAO, escolha: "qualquer" })]) {
    const comandos = consentimentoInicial(() => valor);
    assert.ok(comandos.every((x) => x[2].analytics_storage === "denied"));
  }
  assert.equal(consentimentoInicial(() => { throw new Error("Storage bloqueado"); })[0][2].analytics_storage, "denied");
});
