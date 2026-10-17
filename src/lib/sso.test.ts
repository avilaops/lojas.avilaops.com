import assert from "node:assert/strict";
import test from "node:test";
import { CAMINHO_CRIAR_SSO, CAMINHO_RETORNO, RECADOS_SSO, configSSO, destinoDaEntradaSSO, irDiretoAoAuth, consultarSSO, lerRespostaSSO, podeEntrarComoEquipe, urlDeLoginSSO } from "./sso";

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
    equipe: false,
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
  // Logado no Auth, mas o login social não trouxe e-mail: recado próprio, não "indisponível".
  assert.equal(lerRespostaSSO(200, { autenticado: true, permitido: true, sessao: { nome: "x" } }).tipo, "sem_email");
  assert.equal(lerRespostaSSO(200, { autenticado: true, permitido: true, sessao: { email: 7 } }).tipo, "sem_email");
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

test("equipe da casa é só quem o Auth chama de ADMIN; dono de negócio cliente não é", () => {
  const com = (papel: string) => lerRespostaSSO(200, { autenticado: true, permitido: true, sessao: { email: "a@avilaops.com", nome: "A", papel } });
  assert.equal(podeEntrarComoEquipe(com("ADMIN")), true);
  assert.equal(podeEntrarComoEquipe(com("CLIENTE")), false);
  assert.equal(podeEntrarComoEquipe(com("admin")), false);
  assert.equal(podeEntrarComoEquipe(lerRespostaSSO(200, { autenticado: true, permitido: true, sessao: { email: "a@avilaops.com" } })), false);
});

test("sem liberação no Auth, sem sessão ou com o Auth fora, ninguém entra como equipe", () => {
  assert.equal(podeEntrarComoEquipe(lerRespostaSSO(200, { autenticado: true, permitido: false, sessao: { email: "a@avilaops.com", papel: "ADMIN" } })), false);
  assert.equal(podeEntrarComoEquipe(lerRespostaSSO(401, null)), false);
  assert.equal(podeEntrarComoEquipe(lerRespostaSSO(500, null)), false);
});

test("com LOJAS_EQUIPE, só os e-mails da lista entram, e ainda precisam ser da casa", () => {
  const casa = lerRespostaSSO(200, { autenticado: true, permitido: true, sessao: { email: "Nicolas@AvilaOps.com", papel: "ADMIN" } });
  const cliente = lerRespostaSSO(200, { autenticado: true, permitido: true, sessao: { email: "nicolas@avilaops.com", papel: "CLIENTE" } });
  assert.equal(podeEntrarComoEquipe(casa, { LOJAS_EQUIPE: " nicolas@avilaops.com , socio@avilaops.com " }), true);
  assert.equal(podeEntrarComoEquipe(casa, { LOJAS_EQUIPE: "socio@avilaops.com" }), false);
  assert.equal(podeEntrarComoEquipe(cliente, { LOJAS_EQUIPE: "nicolas@avilaops.com" }), false);
  assert.equal(podeEntrarComoEquipe(casa, { LOJAS_EQUIPE: " , " }), true);
});

test("/entrar só pula para o Auth com sessão do login único; sem ela, a senha da loja aparece", () => {
  const base = { loginUnico: true, temSessaoSSO: true };
  assert.equal(irDiretoAoAuth(base), true);
  // O lojista do cadastro próprio não tem sessão no Auth: vê a página.
  assert.equal(irDiretoAoAuth({ ...base, temSessaoSSO: false }), false);
  assert.equal(irDiretoAoAuth({ ...base, loginUnico: false }), false);
  // Voltou do Auth, o Google falhou ou pediu a senha: nunca volta para lá.
  assert.equal(irDiretoAoAuth({ ...base, sso: "sem-loja" }), false);
  assert.equal(irDiretoAoAuth({ ...base, google: "falhou" }), false);
  assert.equal(irDiretoAoAuth({ ...base, senha: "1" }), false);
});

test("quem volta do Auth sem loja é convidado a criar, e não recebe 'sem-loja'", () => {
  const base = { equipe: false, jaVoltou: true, urlLogin: "https://auth/login" };
  const ok = lerRespostaSSO(200, { autenticado: true, permitido: true, sessao });
  // E-mail social novo, ou diferente do e-mail da loja: vai à confirmação, que explica o caso.
  assert.equal(destinoDaEntradaSSO(ok, { ...base, temLoja: false }), CAMINHO_CRIAR_SSO);
  assert.equal(destinoDaEntradaSSO(ok, { ...base, temLoja: true }), "abrir");
  assert.equal(destinoDaEntradaSSO(ok, { ...base, temLoja: false, equipe: true }), "/entrar/equipe");
  // Sem e-mail nenhum: recado próprio.
  const semEmail = lerRespostaSSO(200, { autenticado: true, permitido: true, sessao: { nome: "x" } });
  assert.equal(destinoDaEntradaSSO(semEmail, { ...base, temLoja: false }), "/entrar?sso=sem-email");
  assert.ok(RECADOS_SSO["sem-email"].includes("e-mail"));
  // Cookie vencido: primeira vez vai ao login do Auth; na volta, para com recado.
  const vencido = lerRespostaSSO(401, { autenticado: false });
  assert.equal(destinoDaEntradaSSO(vencido, { ...base, jaVoltou: false, temLoja: false }), "https://auth/login");
  assert.equal(destinoDaEntradaSSO(vencido, { ...base, temLoja: false }), "/entrar?sso=indisponivel");
  // O recado de indisponível não manda usar uma senha que a pessoa pode não ter.
  assert.match(RECADOS_SSO.indisponivel, /Tente de novo/);
  assert.match(RECADOS_SSO.indisponivel, /Se a sua loja tem senha/);
});
