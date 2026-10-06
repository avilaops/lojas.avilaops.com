import assert from "node:assert/strict";
import test from "node:test";
import { CAMINHO_RETORNO, configSSO, consultarSSO, lerRespostaSSO, urlDeLoginSSO } from "./sso";

const cfg = { url: "https://auth.avilaops.com", app: "lojas-avilaops-com" };
const TOKEN = "aaa.bbb.ccc";
const sessao = { email: "Dona@Loja.com.br ", nome: "Dona", papel: "CLIENTE" };

test("login único fica desligado sem SSO_APP_ID, e não aceita endereço que não seja https", () => {
  assert.equal(configSSO({}), null);
  assert.equal(configSSO({ SSO_APP_ID: "  " }), null);
  assert.equal(configSSO({ SSO_APP_ID: "Lojas App" }), null);
  assert.deepEqual(configSSO({ SSO_APP_ID: "lojas-avilaops-com" }), cfg);
  assert.deepEqual(configSSO({ SSO_APP_ID: "lojas-avilaops-com", SSO_URL: "https://auth.teste.local:8443/" }), {
    url: "https://auth.teste.local:8443",
    app: "lojas-avilaops-com",
  });
  assert.equal(configSSO({ SSO_APP_ID: "lojas-avilaops-com", SSO_URL: "http://auth.avilaops.com" }), null);
  assert.equal(configSSO({ SSO_APP_ID: "lojas-avilaops-com", SSO_URL: "https://auth.avilaops.com/x" }), null);
});

test("a ida ao Auth volta para a rota de entrada, marcada para não ir duas vezes", () => {
  const url = new URL(urlDeLoginSSO(cfg, "lojas.avilaops.com"));
  assert.equal(url.origin, "https://auth.avilaops.com");
  assert.equal(url.pathname, "/login");
  assert.equal(url.searchParams.get("app"), "lojas-avilaops-com");
  assert.equal(url.searchParams.get("returnTo"), `https://lojas.avilaops.com${CAMINHO_RETORNO}?volta=1`);
});

test("só um sim explícito do Auth abre a porta", () => {
  assert.deepEqual(lerRespostaSSO(200, { autenticado: true, permitido: true, sessao }), {
    tipo: "ok",
    email: "dona@loja.com.br",
    nome: "Dona",
  });
  // Auth que não conhece `?app=` responde sem `permitido`: é não, não sim.
  assert.equal(lerRespostaSSO(200, { autenticado: true, sessao }).tipo, "sem_acesso");
  assert.equal(lerRespostaSSO(200, { autenticado: true, permitido: false, sessao }).tipo, "sem_acesso");
  assert.equal(lerRespostaSSO(200, { autenticado: true, permitido: "true", sessao }).tipo, "sem_acesso");
});

test("sem sessão, resposta estranha e erro do Auth não viram entrada", () => {
  assert.equal(lerRespostaSSO(401, { autenticado: false }).tipo, "sem_sessao");
  assert.equal(lerRespostaSSO(200, { autenticado: false, permitido: true, sessao }).tipo, "sem_sessao");
  assert.equal(lerRespostaSSO(200, null).tipo, "indisponivel");
  assert.equal(lerRespostaSSO(200, "ok").tipo, "indisponivel");
  assert.equal(lerRespostaSSO(500, { autenticado: true, permitido: true, sessao }).tipo, "indisponivel");
  assert.equal(lerRespostaSSO(302, null).tipo, "indisponivel");
  assert.equal(lerRespostaSSO(200, { autenticado: true, permitido: true, sessao: { nome: "x" } }).tipo, "indisponivel");
  assert.equal(lerRespostaSSO(200, { autenticado: true, permitido: true, sessao: { email: 7 } }).tipo, "indisponivel");
});

test("a consulta manda só o cookie de sessão, para o app certo, e nunca um token malformado", async () => {
  const chamadas: Array<{ url: string; cookie: string | null }> = [];
  const falso = (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), cookie: new Headers(init?.headers).get("cookie") });
    return Response.json({ autenticado: true, permitido: true, sessao });
  }) as typeof fetch;

  assert.equal((await consultarSSO(cfg, TOKEN, falso)).tipo, "ok");
  assert.deepEqual(chamadas, [
    { url: "https://auth.avilaops.com/api/session?app=lojas-avilaops-com", cookie: "avila_sso=aaa.bbb.ccc" },
  ]);

  // Quem controla o próprio cookie não pode usar o valor para forjar cabeçalho.
  for (const ruim of [undefined, "", "sem-pontos", "a.b", "a.b.c; outro=1", "a.b.c\r\nx-admin: 1", "a.b.c d"]) {
    assert.equal((await consultarSSO(cfg, ruim, falso)).tipo, "sem_sessao", String(ruim));
  }
  assert.equal(chamadas.length, 1, "token malformado não chega a virar requisição");
});

test("Auth fora do ar é indisponível, não erro na cara do lojista", async () => {
  const quebrado = (async () => {
    throw new Error("ECONNREFUSED");
  }) as typeof fetch;
  assert.equal((await consultarSSO(cfg, TOKEN, quebrado)).tipo, "indisponivel");

  const htmlDeErro = (async () => new Response("<html>502</html>", { status: 502 })) as typeof fetch;
  assert.equal((await consultarSSO(cfg, TOKEN, htmlDeErro)).tipo, "indisponivel");
});
