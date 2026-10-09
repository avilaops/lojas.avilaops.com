import assert from "node:assert/strict";
import test from "node:test";
import { CONVITE_DESLIGADO, configConvite, convidarParaAEquipe } from "./convite-equipe";

const env = { SSO_APP_ID: "lojas-avilaops-com", AUTH_CLIENT_ID: "lojas", AUTH_CLIENT_SECRET: "segredo-de-teste" };
const cfg = configConvite(env);
const pedido = { email: " Ana@Loja.com.br ", nome: "Ana Souza", loja: "Casa da Ana", hostBase: "lojas.avilaops.com" };

function auth(status: number, corpo: unknown) {
  const chamadas: { url: string; init: RequestInit }[] = [];
  const buscar = async (url: string, init: RequestInit) => {
    chamadas.push({ url, init });
    return new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
  };
  return { chamadas, buscar };
}

test("convite fica desligado sem o login único ou sem a credencial de sistema", () => {
  assert.equal(configConvite({}), null);
  assert.equal(configConvite({ AUTH_CLIENT_ID: "lojas", AUTH_CLIENT_SECRET: "x" }), null);
  assert.equal(configConvite({ SSO_APP_ID: "lojas-avilaops-com", AUTH_CLIENT_ID: "lojas" }), null);
  assert.deepEqual(cfg, {
    url: "https://auth.avilaops.com/api/provisionamento/acessos",
    autorizacao: `Basic ${Buffer.from("lojas:segredo-de-teste").toString("base64")}`,
  });
});

test("desligado: não chama ninguém e diz ao dono para definir a senha", async () => {
  let chamou = false;
  const r = await convidarParaAEquipe(null, pedido, async () => {
    chamou = true;
    return new Response("{}");
  });
  assert.deepEqual(r, { situacao: "PENDENTE", detalhe: CONVITE_DESLIGADO });
  assert.equal(chamou, false);
});

test("pede o convite com a credencial, o nome da loja e a entrada do painel como destino", async () => {
  const { chamadas, buscar } = auth(201, { criada: true, convite: null, envio: "enviado" });
  assert.deepEqual(await convidarParaAEquipe(cfg, pedido, buscar), { situacao: "ENVIADO", detalhe: "com o endereço para criar a senha" });

  assert.equal(chamadas.length, 1);
  assert.equal(chamadas[0].url, "https://auth.avilaops.com/api/provisionamento/acessos");
  assert.equal(chamadas[0].init.method, "POST");
  assert.equal(new Headers(chamadas[0].init.headers).get("authorization"), cfg?.autorizacao);
  assert.deepEqual(JSON.parse(String(chamadas[0].init.body)), {
    email: "ana@loja.com.br",
    nome: "Ana Souza",
    enviarConvite: true,
    empresa: "Casa da Ana",
    destino: "https://lojas.avilaops.com/api/painel/entrar/sso",
  });
});

test("quem já tinha conta recebe só o endereço do sistema", async () => {
  const { buscar } = auth(200, { criada: false, convite: null, envio: "enviado" });
  assert.equal((await convidarParaAEquipe(cfg, pedido, buscar)).detalhe, "a pessoa já tinha conta Ávila Ops e entra com a senha que já usa");
});

test("e-mail que não saiu vira falha com o motivo, e o endereço da senha nunca aparece", async () => {
  for (const envio of ["sem_email", "limite", "falhou", "outro"]) {
    const { buscar } = auth(201, { criada: true, convite: "https://auth.avilaops.com/recuperar/abc123", envio });
    const r = await convidarParaAEquipe(cfg, pedido, buscar);
    assert.equal(r.situacao, "FALHOU");
    assert.ok(r.detalhe.length > 0 && !JSON.stringify(r).includes("recuperar"));
  }
});

test("recusas do login único: credencial, conta desligada, erro e rede", async () => {
  assert.match((await convidarParaAEquipe(cfg, pedido, auth(401, {}).buscar)).detalhe, /recusou a credencial/);
  assert.deepEqual(await convidarParaAEquipe(cfg, pedido, auth(409, { error: "Esta conta está desligada no login único." }).buscar), {
    situacao: "FALHOU",
    detalhe: "Esta conta está desligada no login único.",
  });
  assert.match((await convidarParaAEquipe(cfg, pedido, auth(500, {}).buscar)).detalhe, /respondeu 500/);
  const semRede = await convidarParaAEquipe(cfg, pedido, async () => {
    throw new Error("sem rede");
  });
  assert.equal(semRede.situacao, "FALHOU");
});
