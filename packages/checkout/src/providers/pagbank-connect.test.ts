import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { definicaoPagBank } from "./pagbank-definicao.ts";

// Nenhum destes testes chama o PagBank: o `fetch` global é um dublê.

const RETORNO = "https://lojas.avilaops.com/api/painel/recebimento/v2/conectar/pagbank/retorno";
const ESTADO = "abc-def_ghi";

interface Chamada {
  url: string;
  init: RequestInit;
}

const fetchOriginal = globalThis.fetch;
let chamadas: Chamada[] = [];
const ambienteOriginal = {
  PAGBANK_CLIENT_ID: process.env.PAGBANK_CLIENT_ID,
  PAGBANK_CLIENT_SECRET: process.env.PAGBANK_CLIENT_SECRET,
  PAGBANK_AMBIENTE: process.env.PAGBANK_AMBIENTE,
};

function dublar(responder: (chamada: Chamada) => Response | Promise<Response>) {
  globalThis.fetch = (async (entrada: string | URL | Request, init?: RequestInit) => {
    const chamada = { url: String(entrada), init: init ?? {} };
    chamadas.push(chamada);
    return responder(chamada);
  }) as typeof fetch;
}

function json(dados: unknown, status = 200) {
  return new Response(JSON.stringify(dados), { status, headers: { "content-type": "application/json" } });
}

function cabecalho(chamada: Chamada, nome: string) {
  return new Headers(chamada.init.headers).get(nome);
}

function corpo(chamada: Chamada): Record<string, unknown> {
  return JSON.parse(String(chamada.init.body)) as Record<string, unknown>;
}

function em(indice: number): Chamada {
  const encontrada = chamadas[indice];
  if (!encontrada) throw new Error(`chamada ${indice} não aconteceu`);
  return encontrada;
}

function oauth() {
  const conectado = definicaoPagBank.oauth;
  assert.ok(conectado);
  return conectado;
}

function restaurarAmbiente(chave: keyof typeof ambienteOriginal) {
  const valor = ambienteOriginal[chave];
  if (valor === undefined) delete process.env[chave];
  else process.env[chave] = valor;
}

describe("PagBank Connect", () => {
  beforeEach(() => {
    chamadas = [];
    process.env.PAGBANK_CLIENT_ID = "app-id-teste";
    process.env.PAGBANK_CLIENT_SECRET = "app-secret-teste";
    delete process.env.PAGBANK_AMBIENTE;
  });

  afterEach(() => {
    globalThis.fetch = fetchOriginal;
    restaurarAmbiente("PAGBANK_CLIENT_ID");
    restaurarAmbiente("PAGBANK_CLIENT_SECRET");
    restaurarAmbiente("PAGBANK_AMBIENTE");
  });

  it("monta a autorização de produção com o retorno e o estado intactos", () => {
    const url = new URL(oauth().urlDeAutorizacao(ESTADO, RETORNO));
    assert.equal(url.origin + url.pathname, "https://connect.pagbank.com.br/oauth2/authorize");
    assert.equal(url.searchParams.get("response_type"), "code");
    assert.equal(url.searchParams.get("client_id"), "app-id-teste");
    assert.equal(url.searchParams.get("redirect_uri"), RETORNO);
    assert.equal(url.searchParams.get("scope"), "payments.create+payments.refund+accounts.read");
    assert.equal(url.searchParams.get("state"), ESTADO);
  });

  it("sandbox troca o host de autorização", () => {
    process.env.PAGBANK_AMBIENTE = "sandbox";
    const url = new URL(oauth().urlDeAutorizacao(ESTADO, RETORNO));
    assert.equal(url.origin, "https://connect.sandbox.pagbank.com.br");
  });

  it("sem o aplicativo da plataforma a autorização não sai", () => {
    delete process.env.PAGBANK_CLIENT_SECRET;
    assert.throws(() => oauth().urlDeAutorizacao(ESTADO, RETORNO), /PAGBANK_CLIENT_ID ou PAGBANK_CLIENT_SECRET/);
  });

  it("troca o código, guarda token e chaves, e rotula a conta", async () => {
    dublar((chamada) => {
      if (chamada.url.endsWith("/oauth2/token")) {
        return json({
          access_token: "TEST-acesso",
          refresh_token: "TEST-refresh",
          expires_in: "3600",
          account_id: "ACCO_TESTE",
          token_type: "Bearer",
        });
      }
      if (chamada.url.endsWith("/public-keys/card")) return json({ public_key: "chave-cartao" });
      if (chamada.url.endsWith("/public-keys/webhook")) return json({ public_key: "chave-webhook" });
      if (chamada.url.endsWith("/accounts/ACCO_TESTE")) {
        return json({ company: { name: "Loja Exemplo" }, email: "loja@example.com" });
      }
      return json({}, 500);
    });

    const resultado = await oauth().concluir(" codigo-teste ", RETORNO);
    const token = em(0);
    assert.equal(token.url, "https://api.pagseguro.com/oauth2/token");
    assert.equal(token.init.method, "POST");
    assert.equal(cabecalho(token, "X_CLIENT_ID"), "app-id-teste");
    assert.equal(cabecalho(token, "X_CLIENT_SECRET"), "app-secret-teste");
    assert.equal(cabecalho(token, "authorization"), null);
    assert.deepEqual(corpo(token), {
      grant_type: "authorization_code",
      code: "codigo-teste",
      redirect_uri: RETORNO,
    });
    assert.equal(em(1).url, "https://api.pagseguro.com/public-keys/card");
    assert.equal(cabecalho(em(1), "authorization"), "Bearer TEST-acesso");
    assert.equal(em(2).url, "https://api.pagseguro.com/public-keys/webhook");
    assert.equal(em(3).url, "https://api.pagseguro.com/accounts/ACCO_TESTE");
    assert.equal(cabecalho(em(3), "x-client-token"), "TEST-acesso");
    assert.equal(resultado.segredos.accessToken, "TEST-acesso");
    assert.equal(resultado.segredos.refreshToken, "TEST-refresh");
    assert.equal(resultado.segredos.chavePublicaWebhook, "chave-webhook");
    assert.equal(resultado.segredos.ambiente, undefined);
    assert.equal(resultado.publicos.publicKey, "chave-cartao");
    assert.equal(resultado.conta, "Loja Exemplo · loja@example.com");
    const expira = new Date(resultado.segredos.expiresEm ?? "").getTime();
    assert.ok(Math.abs(expira - (Date.now() + 3600 * 1000)) < 5_000);
  });

  it("cria a chave quando a leitura responde 404 e segue se a criação falhar", async () => {
    dublar((chamada) => {
      if (chamada.url.endsWith("/oauth2/token")) return json({ access_token: "TEST-acesso", account_id: "ACCO_TESTE" });
      if (chamada.url.endsWith("/public-keys/card") && chamada.init.method !== "POST") return json({}, 404);
      if (chamada.url.endsWith("/public-keys") && chamada.init.method === "POST") {
        assert.deepEqual(corpo(chamada), { type: "card" });
        return json({}, 422);
      }
      if (chamada.url.endsWith("/public-keys/webhook")) return json({}, 500);
      if (chamada.url.includes("/accounts/")) return Promise.reject(new Error("rede"));
      return json({}, 500);
    });

    const resultado = await oauth().concluir("codigo-teste", RETORNO);
    assert.equal(resultado.segredos.accessToken, "TEST-acesso");
    assert.equal(resultado.segredos.chavePublicaWebhook, undefined);
    assert.equal(resultado.publicos.publicKey, undefined);
    assert.equal(resultado.conta, "ACCO_TESTE");
    assert.equal(resultado.segredos.expiresEm, undefined);
  });

  it("sandbox grava o ambiente e fala com o host de teste", async () => {
    process.env.PAGBANK_AMBIENTE = "sandbox";
    dublar((chamada) => {
      if (chamada.url.endsWith("/oauth2/token")) return json({ access_token: "TEST-acesso", expires_in: "xxxxxx" });
      return json({ public_key: "chave" });
    });
    const resultado = await oauth().concluir("codigo-teste", RETORNO);
    assert.equal(em(0).url, "https://sandbox.api.pagseguro.com/oauth2/token");
    assert.equal(resultado.segredos.ambiente, "sandbox");
    assert.equal(resultado.segredos.expiresEm, undefined);
    assert.equal(resultado.conta, undefined);
  });

  it("troca recusada lança sem devolver o código nem o corpo", async () => {
    dublar(() => json({ error: "invalid_grant", code: "codigo-teste", error_description: "segredo vazou" }, 400));
    await assert.rejects(oauth().concluir("codigo-teste", RETORNO), (erro: unknown) => {
      assert.ok(erro instanceof Error);
      assert.equal(erro.message, "O PagBank não devolveu o acesso da conta.");
      assert.equal(erro.message.includes("codigo-teste"), false);
      assert.equal(erro.message.includes("segredo"), false);
      return true;
    });
  });

  it("código vazio não chama a API", async () => {
    dublar(() => json({}));
    await assert.rejects(oauth().concluir("  ", RETORNO), /código de autorização/);
    assert.equal(chamadas.length, 0);
  });
});
