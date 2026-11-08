import assert from "node:assert/strict";
import test from "node:test";
import { configOIDC, criarFluxoOIDC, lerFluxoOIDC, lerIdentidadeOIDC } from "./oidc";

const env = { SSO_APP_ID: "lojas-avilaops-com", LOJAS_BASE_DOMAIN: "localhost", LOJAS_OIDC_CLIENT_ID: "lojas-local", LOJAS_OIDC_CLIENT_SECRET: "teste", LOJAS_OIDC_REDIRECT_URI: "http://localhost:3080/api/painel/entrar/oidc", NODE_ENV: "development" };

test("OIDC permite callback HTTP somente em loopback de desenvolvimento", () => {
  assert.ok(configOIDC(env));
  assert.equal(configOIDC({ ...env, NODE_ENV: "production" }), null);
  assert.equal(configOIDC({ ...env, LOJAS_OIDC_REDIRECT_URI: "http://externo.example/api/painel/entrar/oidc" }), null);
  assert.equal(configOIDC({ ...env, LOJAS_OIDC_REDIRECT_URI: "http://usuario@localhost:3080/api/painel/entrar/oidc" }), null);
  assert.equal(configOIDC({ ...env, LOJAS_OIDC_REDIRECT_URI: `${env.LOJAS_OIDC_REDIRECT_URI}?destino=externo` }), null);
});

test("fluxo cifrado exige state correto, integridade e validade", () => {
  const anterior = process.env.LOJAS_SECRET;
  process.env.LOJAS_SECRET = "12".repeat(32);
  try {
    const fluxo = criarFluxoOIDC(1000);
    assert.ok(lerFluxoOIDC(fluxo.cookie, fluxo.state, 1001));
    assert.equal(lerFluxoOIDC(fluxo.cookie, "outra-sessao", 1001), null);
    assert.equal(lerFluxoOIDC(fluxo.cookie, fluxo.state, 1_000_000), null);
    assert.equal(lerFluxoOIDC(`invalido.${fluxo.cookie}`, fluxo.state, 1001), null);
  } finally {
    if (anterior === undefined) delete process.env.LOJAS_SECRET; else process.env.LOJAS_SECRET = anterior;
  }
});

test("identidade OIDC exige subject, e-mail verificado e aplicação autorizada", () => {
  const identidade = { sub: "conta-1", email: "equipe@avilaops.com", email_verified: true, name: "Equipe", papel: "ADMIN", apps: [env.SSO_APP_ID] };
  assert.equal(lerIdentidadeOIDC(identidade, env.SSO_APP_ID, "conta-1").tipo, "ok");
  assert.equal(lerIdentidadeOIDC({ ...identidade, apps: [] }, env.SSO_APP_ID, "conta-1").tipo, "sem_acesso");
  assert.equal(lerIdentidadeOIDC({ ...identidade, email_verified: false }, env.SSO_APP_ID, "conta-1").tipo, "sem_email");
  assert.equal(lerIdentidadeOIDC(identidade, env.SSO_APP_ID, "outra-conta").tipo, "sem_sessao");
  const cliente = lerIdentidadeOIDC({ ...identidade, papel: "CLIENTE" }, env.SSO_APP_ID, "conta-1");
  assert.ok(cliente.tipo === "ok" && !cliente.equipe);
});
