import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  abrirPedido,
  desafioDeAutenticacao,
  gerarSegredo,
  hashDoSegredo,
  lerPedido,
  lerRegistro,
  metadadosDoRecurso,
  metadadosDoServidor,
  pareceSegredo,
  pkceConfere,
  retornoRegistrado,
  retornoValido,
  selarPedido,
  urlDeRetorno,
  VALIDADE,
} from "./mcp-oauth";

process.env.LOJAS_SECRET ??= "0".repeat(64);

/**
 * O login do conector decide quem recebe um token que age como a loja. Cada
 * teste aqui é um jeito de esse token ir parar com a pessoa errada.
 */

const CLAUDE = "https://claude.ai/api/mcp/auth_callback";
const CHATGPT = "https://chatgpt.com/connector_platform_oauth_redirect";
const CODEX = "http://127.0.0.1:1455/callback";

const verificador = "v".repeat(43);
const desafio = createHash("sha256").update(verificador).digest("base64url");

function pedido(extra: Record<string, string> = {}) {
  return new URLSearchParams({ response_type: "code", client_id: "c1", redirect_uri: CLAUDE, code_challenge: desafio, code_challenge_method: "S256", state: "abc", ...extra });
}

test("descoberta aponta para o domínio-base e só oferece PKCE S256", () => {
  assert.equal(metadadosDoRecurso().resource, "https://lojas.avilaops.com/api/mcp");
  assert.deepEqual(metadadosDoRecurso().authorization_servers, ["https://lojas.avilaops.com"]);
  const s = metadadosDoServidor();
  assert.equal(s.issuer, "https://lojas.avilaops.com");
  assert.equal(s.registration_endpoint, "https://lojas.avilaops.com/oauth/register");
  assert.deepEqual(s.code_challenge_methods_supported, ["S256"]);
  assert.deepEqual(s.token_endpoint_auth_methods_supported, ["none"]);
  assert.match(desafioDeAutenticacao(), /resource_metadata="https:\/\/lojas\.avilaops\.com\/\.well-known\/oauth-protected-resource"/);
});

test("retorno aceita https, a própria máquina e esquema de aplicativo", () => {
  for (const uri of [CLAUDE, CHATGPT, CODEX, "http://localhost:3000/cb", "cursor://anysphere.cursor-retrieval/oauth/callback"]) {
    assert.equal(retornoValido(uri), true, uri);
  }
});

test("retorno recusa http de fora, fragmento, credencial e esquema que executa", () => {
  for (const uri of ["http://exemplo.com/cb", "https://claude.ai/cb#x", "https://u:s@claude.ai/cb", "javascript:alert(1)", "data:text/html,x", "nada", ""]) {
    assert.equal(retornoValido(uri), false, uri);
  }
});

test("retorno pedido tem que ser o registrado; na própria máquina a porta varia", () => {
  assert.equal(retornoRegistrado(CLAUDE, [CLAUDE]), true);
  assert.equal(retornoRegistrado("https://claude.ai.exemplo.com/api/mcp/auth_callback", [CLAUDE]), false);
  assert.equal(retornoRegistrado(`${CLAUDE}?x=1`, [CLAUDE]), false);
  assert.equal(retornoRegistrado("http://127.0.0.1:52001/callback", [CODEX]), true);
  assert.equal(retornoRegistrado("http://127.0.0.1:52001/outro", [CODEX]), false);
  assert.equal(retornoRegistrado("http://localhost:52001/callback", [CODEX]), false);
});

test("registro guarda nome curto e recusa cliente com segredo", () => {
  const ok = lerRegistro({ client_name: "  Claude\n\n  Desktop  ", redirect_uris: [CLAUDE, CLAUDE] });
  assert.deepEqual("cliente" in ok && ok.cliente, { nome: "Claude Desktop", retornos: [CLAUDE] });

  const semNome = lerRegistro({ redirect_uris: [CODEX] });
  assert.equal("cliente" in semNome && semNome.cliente.nome, "Assistente de IA");

  assert.equal("erro" in lerRegistro({ redirect_uris: [] }), true);
  assert.equal("erro" in lerRegistro({ redirect_uris: ["http://exemplo.com/cb"] }), true);
  assert.equal("erro" in lerRegistro({ redirect_uris: [CLAUDE], token_endpoint_auth_method: "client_secret_basic" }), true);
  assert.equal("erro" in lerRegistro(null), true);
});

test("PKCE confere só com o verificador que gerou o desafio", () => {
  assert.equal(pkceConfere(verificador, desafio), true);
  assert.equal(pkceConfere("x".repeat(43), desafio), false);
  assert.equal(pkceConfere("curto", desafio), false);
});

test("pedido completo é aceito", () => {
  const r = lerPedido(pedido(), { id: "c1", retornos: [CLAUDE] });
  assert.deepEqual(r, { tipo: "ok", pedido: { clienteId: "c1", retorno: CLAUDE, desafio, state: "abc" } });
});

test("cliente desconhecido ou retorno fora do registro nunca é redirecionado", () => {
  // Devolver erro a um retorno não conferido seria redirecionador aberto.
  assert.equal(lerPedido(pedido(), null).tipo, "recusar");
  assert.equal(lerPedido(pedido({ redirect_uri: "https://atacante.exemplo/cb" }), { id: "c1", retornos: [CLAUDE] }).tipo, "recusar");
});

test("pedido sem PKCE volta ao cliente como erro, com o state dele", () => {
  const p = pedido();
  p.delete("code_challenge");
  const r = lerPedido(p, { id: "c1", retornos: [CLAUDE] });
  assert.equal(r.tipo, "devolver");
  assert.equal(r.tipo === "devolver" && r.erro, "invalid_request");
  assert.equal(r.tipo === "devolver" && r.state, "abc");

  assert.equal(lerPedido(pedido({ code_challenge_method: "plain" }), { id: "c1", retornos: [CLAUDE] }).tipo, "devolver");
  assert.equal(lerPedido(pedido({ response_type: "token" }), { id: "c1", retornos: [CLAUDE] }).tipo, "devolver");
});

test("resource de outro servidor é recusado; o nosso passa com ou sem barra", () => {
  const cliente = { id: "c1", retornos: [CLAUDE] };
  assert.equal(lerPedido(pedido({ resource: "https://lojas.avilaops.com/api/mcp" }), cliente).tipo, "ok");
  assert.equal(lerPedido(pedido({ resource: "https://lojas.avilaops.com/api/mcp/" }), cliente).tipo, "ok");
  assert.equal(lerPedido(pedido({ resource: "https://lojas.avilaops.com" }), cliente).tipo, "ok");
  const outro = lerPedido(pedido({ resource: "https://outro.exemplo/mcp" }), cliente);
  assert.equal(outro.tipo === "devolver" && outro.erro, "invalid_target");
});

test("pedido selado abre igual, e adulterado ou vencido não abre", () => {
  const p = { clienteId: "c1", retorno: CLAUDE, desafio, state: "abc" };
  const selado = selarPedido(p, 1_000);
  assert.deepEqual(abrirPedido(selado, 2_000), p);
  assert.equal(abrirPedido(selado, 1_000 + VALIDADE.pedidoMs), null);

  const [, assinatura] = selado.split(".");
  const forjado = Buffer.from(JSON.stringify({ ...p, retorno: "https://atacante.exemplo/cb", exp: 9e15 })).toString("base64url");
  assert.equal(abrirPedido(`${forjado}.${assinatura}`, 2_000), null);
  assert.equal(abrirPedido("", 2_000), null);
});

test("segredo gerado tem o prefixo do tipo e só o hash é comparável", () => {
  const { valor, hash } = gerarSegredo("acesso");
  assert.equal(pareceSegredo("acesso", valor), true);
  assert.equal(pareceSegredo("renovacao", valor), false);
  assert.equal(hash, hashDoSegredo(valor));
  assert.notEqual(gerarSegredo("acesso").valor, valor);
});

test("retorno preserva a query do cliente e omite state vazio", () => {
  assert.equal(urlDeRetorno("https://a.exemplo/cb?x=1", { code: "c", state: null }), "https://a.exemplo/cb?x=1&code=c");
  assert.equal(urlDeRetorno(CLAUDE, { error: "access_denied", state: "abc" }), `${CLAUDE}?error=access_denied&state=abc`);
});
