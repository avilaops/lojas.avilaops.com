import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import type { Tenant } from "@prisma/client";
import { cifrar } from "./cofre";
import { conectar, emitirState, lerState, testarConexaoMelhorEnvio, tokenDaLoja, urlDeAutorizacao } from "./melhor-envio-conta";
import { prisma } from "./db";

// O módulo lê o ambiente na hora da chamada, não na importação.
process.env.LOJAS_SECRET ??= "0".repeat(64);
process.env.MELHOR_ENVIO_CLIENT_ID = "123";
delete process.env.MELHOR_ENVIO_URL;
const LOJA_TESTE = { slug: "loja-teste", recursos: ["frete_melhor_envio_sandbox"] };

function simularGravacao(t: TestContext, resultado: unknown = null) {
  const delegado = prisma.tenant;
  const original = delegado.update;
  const gravar = t.mock.fn(async (dados: Parameters<typeof original>[0]) => { void dados; return resultado; });
  delegado.update = gravar as unknown as typeof original;
  t.after(() => { delegado.update = original; });
  return gravar;
}

/**
 * O `state` é o que impede a conta de um lojista de ser gravada na loja de
 * outro: o retorno do OAuth é uma rota só, e quem diz de quem é a autorização
 * é ele.
 */

test("state emitido volta com o slug da loja", () => {
  assert.equal(lerState(emitirState("brilhax")), "brilhax");
});

test("state com o slug trocado é recusado", () => {
  const [, assinatura] = emitirState("brilhax").split(".");
  const forjado = Buffer.from(JSON.stringify({ slug: "vedashow", exp: Date.now() + 60_000 })).toString("base64url");
  assert.equal(lerState(`${forjado}.${assinatura}`), null);
});

test("slug em claro, que era o state do Mercado Livre, não passa", () => {
  assert.equal(lerState("brilhax"), null);
  assert.equal(lerState(""), null);
  assert.equal(lerState(null), null);
});

test("state vencido é recusado", (t) => {
  const state = emitirState("brilhax");
  t.mock.timers.enable({ apis: ["Date"], now: Date.now() + 16 * 60_000 });
  assert.equal(lerState(state), null);
});

test("a autorização pede só cotação e leitura da conta, e volta para o retorno da plataforma", () => {
  const url = new URL(urlDeAutorizacao({ ...LOJA_TESTE, slug: "brilhax" }, "https://lojas.avilaops.com"));
  assert.equal(url.origin + url.pathname, "https://sandbox.melhorenvio.com.br/oauth/authorize");
  assert.equal(url.searchParams.get("client_id"), "123");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.get("redirect_uri"), "https://lojas.avilaops.com/melhor-envio/callback");
  assert.equal(url.searchParams.get("scope"), "shipping-calculate users-read");
  assert.equal(lerState(url.searchParams.get("state")), "brilhax");
});

test("teste explícito consulta /api/v2/me mesmo com token local ainda válido", async (t) => {
  const chamadas: string[] = [];
  t.mock.method(globalThis, "fetch", async (entrada: RequestInfo | URL) => {
    chamadas.push(String(entrada));
    return Response.json({ id: 123 }, { status: 200 });
  });
  const loja = {
    slug: "brilhax",
    recursos: LOJA_TESTE.recursos,
    melhorEnvioAccessTokenEnc: cifrar("token-valido"),
    melhorEnvioRefreshTokenEnc: cifrar("refresh-valido"),
    melhorEnvioExpiraEm: new Date(Date.now() + 10 * 86_400_000),
  } as Tenant;

  await testarConexaoMelhorEnvio(loja);
  assert.deepEqual(chamadas, ["https://sandbox.melhorenvio.com.br/api/v2/me"]);
});

test("loja fora da lista de sandbox não autoriza, não troca code e não usa token", async (t) => {
  const fetchMock = t.mock.method(globalThis, "fetch", async () => { throw new Error("Não deveria chamar rede"); });
  const naoAutorizada: Pick<Tenant, "slug" | "recursos"> = { slug: "loja-nao-autorizada", recursos: [] };
  assert.throws(() => urlDeAutorizacao(naoAutorizada, "https://lojas.avilaops.com"), /lojas de teste/);
  await assert.rejects(conectar(naoAutorizada, "codigo", "https://lojas.avilaops.com"), /lojas de teste/);
  assert.equal(await tokenDaLoja({ ...naoAutorizada, melhorEnvioAccessTokenEnc: cifrar("token"),
    melhorEnvioRefreshTokenEnc: cifrar("refresh"), melhorEnvioExpiraEm: new Date(Date.now() + 3 * 86_400_000) } as Tenant), null);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("troca OAuth recusada não persiste tokens mesmo se o corpo os contiver", async (t) => {
  const update = simularGravacao(t);
  t.mock.method(globalThis, "fetch", async () => Response.json({
    access_token: "token-indesejado", refresh_token: "refresh-indesejado", message: "conteudo-secreto",
  }, { status: 401 }));
  await assert.rejects(conectar(LOJA_TESTE, "codigo", "https://lojas.avilaops.com"), /^Error: Melhor Envio recusou a autorização \(HTTP 401\)\.$/);
  assert.equal(update.mock.callCount(), 0);
});

test("token e validade malformados não chegam ao banco nem à leitura da conta", async (t) => {
  const update = simularGravacao(t);
  const respostas = [
    { access_token: {}, refresh_token: "refresh" },
    { access_token: "token", refresh_token: "" },
    { access_token: "token", refresh_token: "refresh", expires_in: -1 },
    { access_token: "token", refresh_token: "refresh", expires_in: "2592000" },
    { access_token: "token", refresh_token: "refresh", expires_in: 1e20 },
  ];
  const fetchMock = t.mock.method(globalThis, "fetch", async () => Response.json(respostas.shift()));
  for (let i = 0; i < 5; i++) {
    await assert.rejects(conectar(LOJA_TESTE, "codigo", "https://lojas.avilaops.com"), /Resposta de autorização inválida/);
  }
  assert.equal(fetchMock.mock.callCount(), 5);
  assert.equal(update.mock.callCount(), 0);
});

test("conexão válida guarda os tokens cifrados somente na loja autorizada", async (t) => {
  const chamadas: Array<{ url: string; corpo: Record<string, string> | null }> = [];
  t.mock.method(globalThis, "fetch", async (entrada: string, init: RequestInit) => {
    assert.equal(init.cache, "no-store");
    assert.equal(init.redirect, "error");
    chamadas.push({ url: String(entrada), corpo: init.body ? JSON.parse(String(init.body)) : null });
    return String(entrada).endsWith("/oauth/token")
      ? Response.json({ access_token: "token-de-teste", refresh_token: "refresh-de-teste", expires_in: 2592000 })
      : Response.json({ firstname: "Conta", lastname: "Teste", email: "conta@example.invalid" });
  });
  const update = simularGravacao(t, { slug: "loja-teste", melhorEnvioConta: "Conta Teste" });
  await conectar(LOJA_TESTE, "codigo-teste", "https://lojas.avilaops.com");
  const gravacao = update.mock.calls[0].arguments[0];
  assert.deepEqual(gravacao.where, { slug: "loja-teste" });
  assert.match(String(gravacao.data.melhorEnvioAccessTokenEnc), /^v1\./);
  assert.doesNotMatch(JSON.stringify(gravacao), /token-de-teste|refresh-de-teste/);
  assert.equal(chamadas[0].corpo?.redirect_uri, "https://lojas.avilaops.com/melhor-envio/callback");
  assert.equal(chamadas[0].corpo?.grant_type, "authorization_code");
  assert.equal(chamadas[1].url, "https://sandbox.melhorenvio.com.br/api/v2/me");
});

test("refresh HTTP recusado preserva os tokens anteriores e não vaza resposta no log", async (t) => {
  const segredoAnterior = process.env.MELHOR_ENVIO_CLIENT_SECRET;
  process.env.MELHOR_ENVIO_CLIENT_SECRET = "secret-teste";
  t.after(() => {
    if (segredoAnterior === undefined) delete process.env.MELHOR_ENVIO_CLIENT_SECRET;
    else process.env.MELHOR_ENVIO_CLIENT_SECRET = segredoAnterior;
  });
  const logs: unknown[][] = [];
  t.mock.method(console, "error", (...args: unknown[]) => logs.push(args));
  t.mock.method(globalThis, "fetch", async () => Response.json({ message: "segredo-no-retorno" }, { status: 400 }));
  const update = simularGravacao(t);
  const loja = {
    ...LOJA_TESTE, melhorEnvioAccessTokenEnc: cifrar("anterior"),
    melhorEnvioRefreshTokenEnc: cifrar("refresh-anterior"), melhorEnvioExpiraEm: new Date(0),
  } as Tenant;
  assert.equal(await tokenDaLoja(loja), null);
  assert.equal(update.mock.callCount(), 0);
  assert.doesNotMatch(JSON.stringify(logs), /segredo-no-retorno|refresh-anterior|secret-teste/);
});
