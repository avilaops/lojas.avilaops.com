import assert from "node:assert/strict";
import test from "node:test";
import { ERRO_CONTADO, erroJaContado, hostDoSlug, hostDoWebhook, medirRota, registrarSemDerrubar } from "./metricas-rota";
import { HOST_SEM_LOJA, RegistroDeMetricas } from "./metricas-tenant";

function requisicao(url: string, cabecalhos: Record<string, string> = {}) {
  return new Request(url, { headers: cabecalhos });
}

test("resposta 200 e 503 são registradas com o status e uma duração, no host da requisição", async () => {
  const registro = new RegistroDeMetricas();
  const ok = medirRota("busca", async () => Response.json({ produtos: [] }), { registro });
  const fora = medirRota("checkout", async () => Response.json({ erro: "x" }, { status: 503 }), { registro });

  const r1 = await ok(requisicao("http://interno:3080/api/busca?q=caneca", { host: "Loja.com.br:443" }));
  const r2 = await fora(requisicao("http://interno:3080/api/checkout", { host: "loja.com.br" }));
  assert.equal(r1.status, 200);
  assert.deepEqual(await r1.json(), { produtos: [] }, "a resposta sai intacta");
  assert.equal(r2.status, 503);

  const loja = registro.resumo().hosts["loja.com.br"];
  assert.deepEqual([loja.busca!.requisicoes, loja.busca!.erros], [1, 0]);
  assert.deepEqual([loja.checkout!.requisicoes, loja.checkout!.erros], [1, 1]);
  assert.equal(typeof loja.busca!.p50Ms, "number");
});

test("x-forwarded-host vale antes do host, como em tenantAtual", async () => {
  const registro = new RegistroDeMetricas();
  await medirRota("frete", async () => new Response("ok"), { registro })(
    requisicao("http://interno/api/frete", { host: "127.0.0.1:3080", "x-forwarded-host": "loja.com.br" }),
  );
  assert.deepEqual(Object.keys(registro.resumo().hosts), ["loja.com.br"]);
});

test("os argumentos além do request chegam ao manipulador", async () => {
  const registro = new RegistroDeMetricas();
  const rota = medirRota("outra", async (_r: Request, s: { params: Promise<{ id: string }> }) => Response.json(await s.params), { registro });
  const r = await rota(requisicao("http://interno/x"), { params: Promise.resolve({ id: "42" }) });
  assert.deepEqual(await r.json(), { id: "42" });
});

test("manipulador que lança é registrado como 500, marcado e relançado: é o mesmo erro", async () => {
  const registro = new RegistroDeMetricas();
  const erro = new Error("gateway caiu");
  const rota = medirRota("checkout", async () => { throw erro; }, { registro });
  await assert.rejects(rota(requisicao("http://interno/api/checkout", { host: "loja.com.br" })), (e) => e === erro);
  assert.equal(erroJaContado(erro), true);
  assert.deepEqual(Object.keys(erro), [], "a marca não aparece em quem enumera o erro");
  assert.equal((erro as unknown as Record<symbol, unknown>)[ERRO_CONTADO], true);
  const c = registro.resumo().hosts["loja.com.br"].checkout!;
  assert.deepEqual([c.requisicoes, c.erros], [1, 1]);
});

test("erro que não é objeto, ou está congelado, é relançado do mesmo jeito", async () => {
  const registro = new RegistroDeMetricas();
  await assert.rejects(medirRota("frete", async () => { throw "texto"; }, { registro })(requisicao("http://interno/")), (e) => e === "texto");
  const congelado = Object.freeze(new Error("congelado"));
  await assert.rejects(medirRota("frete", async () => { throw congelado; }, { registro })(requisicao("http://interno/")), (e) => e === congelado);
  assert.equal(erroJaContado("texto"), false);
  assert.equal(erroJaContado(null), false);
  assert.equal(erroJaContado(new Error("outro")), false);
});

test("registro que falha não muda a resposta nem o erro do manipulador", async () => {
  const quebrado = { registrar() { throw new Error("registro quebrado"); } };
  const r = await medirRota("busca", async () => Response.json({ ok: true }, { status: 201 }), { registro: quebrado })(requisicao("http://interno/"));
  assert.equal(r.status, 201);
  assert.deepEqual(await r.json(), { ok: true });

  const erro = new Error("o original");
  await assert.rejects(medirRota("busca", async () => { throw erro; }, { registro: quebrado })(requisicao("http://interno/")), (e) => e === erro);
  assert.doesNotThrow(() => registrarSemDerrubar({ host: "a.com", grupo: "busca", status: 200, duracaoMs: 1 }, quebrado));

  // Função de host que lança também não derruba: a amostra cai em `_sem-host`.
  const registro = new RegistroDeMetricas();
  const ok = await medirRota("webhook", async () => new Response("ok"), { registro, host: () => { throw new Error("url ruim"); } })(requisicao("http://interno/"));
  assert.equal(ok.status, 200);
  assert.deepEqual(Object.keys(registro.resumo().hosts), ["_sem-host"]);
});

test("webhook com token na query, authorization e cookie não deixa nenhum deles no resumo", async () => {
  const registro = new RegistroDeMetricas();
  const rota = medirRota("webhook", async () => { throw new Error("assinatura segredo-do-erro inválida"); }, { registro, host: hostDoWebhook });
  const pedido = new Request("https://lojas.avilaops.com/api/webhooks/mercadopago?loja=x&token=segredo-abc&data.id=998877", {
    method: "POST",
    headers: {
      authorization: "Bearer segredo-do-authorization",
      cookie: "lojas_sessao=valor-do-cookie",
      "user-agent": "MercadoPago WebHook v1.0",
      "x-forwarded-for": "203.0.113.77",
      "x-signature": "ts=1,v1=assinatura-do-mp",
    },
    body: JSON.stringify({ email: "cliente@example.test" }),
  });
  await assert.rejects(rota(pedido));
  const texto = JSON.stringify(registro.resumo());
  for (const proibido of [
    "segredo-abc", "token", "998877", "segredo-do-authorization", "Bearer", "valor-do-cookie", "lojas_sessao",
    "MercadoPago", "203.0.113.77", "assinatura-do-mp", "cliente@example.test", "segredo-do-erro", "/api/webhooks",
  ]) {
    assert.equal(texto.includes(proibido), false, `"${proibido}" vazou para o resumo`);
  }
  assert.deepEqual(Object.keys(registro.resumo().hosts), ["x.lojas.avilaops.com"], "só o slug saiu da query");
});

test("slug que não é slug não vira host: cai em _sem-loja", async () => {
  assert.equal(hostDoSlug("Minha-Loja"), "minha-loja.lojas.avilaops.com");
  for (const ruim of ["", null, undefined, "a.b", "../etc", "x y", "ç", "a".repeat(64), "-abc"]) assert.equal(hostDoSlug(ruim), null, String(ruim));
  assert.equal(hostDoWebhook(requisicao("https://lojas.avilaops.com/api/webhooks/mercadopago")), null);

  const registro = new RegistroDeMetricas();
  await medirRota("webhook", async () => Response.json({ erro: "loja ausente" }, { status: 400 }), { registro, host: hostDoWebhook })(
    requisicao("https://lojas.avilaops.com/api/webhooks/mercadopago?loja=evil.example.com%2F..", { host: "lojas.avilaops.com" }),
  );
  assert.deepEqual(Object.keys(registro.resumo().hosts), [HOST_SEM_LOJA]);
});
