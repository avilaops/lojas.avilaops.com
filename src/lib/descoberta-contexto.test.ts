import assert from "node:assert/strict";
import test from "node:test";
import { paginaPermiteDescoberta, requisicaoTemSessaoPrivada } from "./descoberta-contexto";
import { ficaNaRaiz } from "./rotas-da-raiz";

test("descoberta pública fica na raiz também no domínio da plataforma", () => {
  assert.equal(ficaNaRaiz("/ai-catalog.json"), true);
  assert.equal(ficaNaRaiz("/.well-known/ard.json"), true);
  assert.equal(ficaNaRaiz("/ai-catalog.json/inventado"), false);
});

test("ferramentas só recebem páginas públicas explícitas sem consulta particular", () => {
  for (const caminho of ["/", "/produtos", "/produtos/anel-azul", "/categoria/componentes", "/sobre", "/contato", "/politicas/envio", "/blog/como-escolher"]) {
    assert.equal(paginaPermiteDescoberta(caminho, "", false), true, caminho);
  }
  for (const caminho of ["/entrar", "/criar", "/recuperar", "/auth", "/oauth/authorize", "/conta", "/conta/pedidos", "/painel", "/plataforma/painel", "/api/produtos", "/checkout", "/carrinho", "/cart", "/pedido/123", "/nao-encontrado", "/blog/%2fconta", "/produtos/../conta"]) {
    assert.equal(paginaPermiteDescoberta(caminho, "", false), false, caminho);
  }
  assert.equal(paginaPermiteDescoberta("/produtos", "q=consulta-privada", false), false);
  assert.equal(paginaPermiteDescoberta("/", "preview=1", false), false);
});

test("plataforma aceita suas páginas de leitura e exclui cadastro, autorização e painel", () => {
  for (const caminho of ["/", "/ajuda", "/developers", "/developers/privacidade", "/marca", "/termos-comerciais", "/blog/primeiros-passos"]) {
    assert.equal(paginaPermiteDescoberta(caminho, "", true), true, caminho);
  }
  for (const caminho of ["/produtos", "/entrar", "/criar/sso", "/autorizar", "/confirmar", "/redefinir", "/painel/clientes"]) {
    assert.equal(paginaPermiteDescoberta(caminho, "", true), false, caminho);
  }
});

test("sessão de comprador, lojista ou personalização não habilita o adaptador público", () => {
  for (const cookie of ["loja_conta=token", "outro=1; lojas_sessao=token", "minha-moto=7"]) {
    assert.equal(requisicaoTemSessaoPrivada(cookie), true);
  }
  assert.equal(requisicaoTemSessaoPrivada("consentimento=recusado; outro=1"), false);
  assert.equal(requisicaoTemSessaoPrivada(null), false);
});
