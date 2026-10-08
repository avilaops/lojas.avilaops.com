import assert from "node:assert/strict";
import { existsSync, readdirSync } from "node:fs";
import test from "node:test";
import { ehRetornoDeAutorizacao, ficaNaRaiz } from "./rotas-da-raiz";

/**
 * O proxy reescreve o domínio-base para `/plataforma`. Rota de retorno que não
 * está nas exceções vira 404 só em produção, depois de o lojista já ter
 * autorizado — e foi assim que o retorno do Melhor Envio nasceu quebrado.
 */

test("retorno de autorização e contratos de API ficam na raiz", () => {
  for (const caminho of ["/api/health", "/v1/eventos", "/ml/callback", "/ml/notifications", "/melhor-envio/callback", "/mercado-pago/callback", "/canais/shopee/callback", "/oauth/authorize", "/oauth/token", "/.well-known/oauth-protected-resource/api/mcp", "/.well-known/oauth-authorization-server", "/plataforma/painel"]) {
    assert.equal(ficaNaRaiz(caminho), true, caminho);
  }
});

test("painel e página de venda continuam indo para a plataforma", () => {
  for (const caminho of ["/", "/painel", "/painel/configuracoes/entrega", "/entrar", "/criar", "/melhor-envio", "/mercado-pago", "/mlx/callback", "/canais", "/autorizar", "/oauth"]) {
    assert.equal(ficaNaRaiz(caminho), false, caminho);
  }
});

test("toda rota de retorno que existe em src/app está nas exceções do proxy", () => {
  // Procura `callback/route.ts` na raiz de src/app, fora de `api` e de
  // `plataforma`: são os endereços cadastrados em serviço de fora.
  const raiz = "src/app";
  const retornos: string[] = [];
  const descer = (pasta: string, caminho: string) => {
    for (const item of readdirSync(pasta, { withFileTypes: true })) {
      if (!item.isDirectory()) continue;
      const proximo = `${caminho}/${item.name}`;
      if (item.name === "callback" && existsSync(`${pasta}/${item.name}/route.ts`)) retornos.push(proximo);
      else descer(`${pasta}/${item.name}`, proximo);
    }
  };
  for (const item of readdirSync(raiz, { withFileTypes: true })) {
    if (item.isDirectory() && !["api", "plataforma"].includes(item.name)) descer(`${raiz}/${item.name}`, `/${item.name}`);
  }

  assert.ok(retornos.includes("/ml/callback") && retornos.includes("/melhor-envio/callback") && retornos.includes("/mercado-pago/callback"), `retornos encontrados: ${retornos.join(", ")}`);
  for (const retorno of retornos) {
    // Segmento dinâmico (`[canal]`) é conferido com um valor qualquer no lugar.
    const exemplo = retorno.replace(/\[[^\]]+\]/g, "x");
    assert.equal(ficaNaRaiz(exemplo), true, `${retorno} viraria /plataforma${retorno} e responderia 404`);
    assert.equal(ehRetornoDeAutorizacao(exemplo), true, `${retorno} precisa sair com no-store`);
  }
});
