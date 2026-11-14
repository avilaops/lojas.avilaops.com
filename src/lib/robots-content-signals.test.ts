import assert from "node:assert/strict";
import test from "node:test";
import type { Tenant } from "@prisma/client";
import { sinaisConteudoLoja, textoRobotsComSinais } from "./robots-content-signals";

test("Content Signals da loja acompanham publicação e a escolha de treinamento", () => {
  const loja = (status: string, permiteTreinamentoIa: boolean) => ({ status, permiteTreinamentoIa }) as Pick<Tenant, "status" | "permiteTreinamentoIa">;
  for (const status of ["ATIVA", "SUSPENSA"]) {
    assert.deepEqual(sinaisConteudoLoja(loja(status, false)), { busca: true, entradaIa: true, treinamento: false });
    assert.deepEqual(sinaisConteudoLoja(loja(status, true)), { busca: true, entradaIa: true, treinamento: true });
  }
  for (const status of ["CANCELADA", "PROVISIONANDO"]) {
    assert.deepEqual(sinaisConteudoLoja(loja(status, true)), { busca: false, entradaIa: false, treinamento: false });
  }
});

test("texto mantém caminhos privados, grupos de robôs e sitemaps", () => {
  const texto = textoRobotsComSinais({ rules: [
    { userAgent: "*", allow: "/", disallow: ["/conta$", "/conta/", "/api/"] },
    { userAgent: ["GPTBot", "Google-Extended"], disallow: "/" },
  ], sitemap: ["https://loja.example/sitemap.xml", "https://loja.example/sitemap-produtos.xml"] }, { busca: true, entradaIa: true, treinamento: false });
  assert.match(texto, /^User-Agent: \*\nContent-Signal: search=yes, ai-input=yes, ai-train=no\nAllow: \/\n/);
  assert.match(texto, /Disallow: \/conta\$\nDisallow: \/conta\/\nDisallow: \/api\//);
  assert.match(texto, /User-Agent: GPTBot\nUser-Agent: Google-Extended\nContent-Signal: search=yes, ai-input=yes, ai-train=no\nDisallow: \/\n/);
  assert.equal((texto.match(/Content-Signal:/g) ?? []).length, 2);
  assert.ok(texto.endsWith("Sitemap: https://loja.example/sitemap-produtos.xml\n"));
});

test("plataforma pode declarar as três categorias liberadas sem perder as rotas de acesso", () => {
  const texto = textoRobotsComSinais({ rules: { userAgent: "*", allow: "/", disallow: ["/painel", "/entrar"] } }, { busca: true, entradaIa: true, treinamento: true });
  assert.match(texto, /Content-Signal: search=yes, ai-input=yes, ai-train=yes/);
  assert.match(texto, /Disallow: \/painel\nDisallow: \/entrar\n/);
});

test("host desconhecido continua fechado com as três categorias negadas", () => {
  const texto = textoRobotsComSinais({ rules: { userAgent: "*", disallow: "/" } }, { busca: false, entradaIa: false, treinamento: false });
  assert.equal(texto, "User-Agent: *\nContent-Signal: search=no, ai-input=no, ai-train=no\nDisallow: /\n");
});
