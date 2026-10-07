import assert from "node:assert/strict";
import test from "node:test";
import {
  GRUPOS,
  HOST_OUTROS,
  HOST_SEM_HOST,
  MAXIMO_DE_HOSTS,
  RegistroDeMetricas,
  chaveDoHost,
  percentil,
  registroGlobal,
} from "./metricas-tenant";
import { normalizarHost } from "./tenant";

const MINUTO = 60_000;

function comRelogio(inicio = 1_800_000_000_000) {
  const relogio = { agora: inicio };
  return { relogio, registro: new RegistroDeMetricas(() => relogio.agora) };
}

test("percentil sai como o limite superior do balde, e duração no limite fica no próprio balde", () => {
  const { registro } = comRelogio();
  for (const duracaoMs of [25, 25.1, 50, 100, 100, 100, 100, 100, 100, 100]) {
    registro.registrar({ host: "a.lojas.avilaops.com", grupo: "busca", status: 200, duracaoMs });
  }
  const busca = registro.resumo({ minutos: 60 }).hosts["a.lojas.avilaops.com"].busca!;
  assert.equal(busca.requisicoes, 10);
  assert.deepEqual(busca.histograma.slice(0, 3), [1, 2, 7], "25 fica no balde de 25; 25,1 e 50 no de 50");
  assert.equal(busca.p50Ms, 100);
  assert.equal(busca.p95Ms, 100);
  assert.equal(busca.acimaDoTeto, false);
});

test("uma amostra lenta em vinte aparece no p95 e não no p50", () => {
  const { registro } = comRelogio();
  for (let i = 0; i < 19; i++) registro.registrar({ host: "a.com", grupo: "checkout", status: 200, duracaoMs: 40 });
  registro.registrar({ host: "a.com", grupo: "checkout", status: 200, duracaoMs: 1800 });
  registro.registrar({ host: "a.com", grupo: "checkout", status: 200, duracaoMs: 1800 });
  const c = registro.resumo().hosts["a.com"].checkout!;
  assert.equal(c.p50Ms, 50);
  assert.equal(c.p95Ms, 2500);
});

test("sem amostra o percentil é null; acima de 5000 sai o teto com acimaDoTeto", () => {
  assert.deepEqual(percentil([0, 0, 0, 0, 0, 0, 0, 0, 0], 0.5), { ms: null, acimaDoTeto: false });
  const { registro } = comRelogio();
  registro.registrar({ host: "a.com", grupo: "frete", status: 200, duracaoMs: 5000 });
  assert.equal(registro.resumo().hosts["a.com"].frete!.acimaDoTeto, false, "5000 exatos ainda cabem no último limite");
  registro.registrar({ host: "a.com", grupo: "frete", status: 200, duracaoMs: 9000 });
  registro.registrar({ host: "a.com", grupo: "frete", status: 200, duracaoMs: 9000 });
  const frete = registro.resumo().hosts["a.com"].frete!;
  assert.equal(frete.p95Ms, 5000);
  assert.equal(frete.acimaDoTeto, true);
});

test("5xx conta erro; 4xx conta requisição e não erro", () => {
  const { registro } = comRelogio();
  for (const status of [200, 404, 422, 499, 500, 503]) registro.registrar({ host: "a.com", grupo: "checkout", status, duracaoMs: 10 });
  const c = registro.resumo().hosts["a.com"].checkout!;
  assert.equal(c.requisicoes, 6);
  assert.equal(c.erros, 2);
});

test("erro sem duração conta requisição e erro, e fica fora do histograma", () => {
  const { registro } = comRelogio();
  registro.registrar({ host: "a.com", grupo: "render", status: 200, duracaoMs: 400 });
  registro.registrarErro({ host: "a.com", grupo: "render" });
  const r = registro.resumo().hosts["a.com"].render!;
  assert.equal(r.requisicoes, 2);
  assert.equal(r.erros, 1);
  assert.equal(r.histograma.reduce((s, n) => s + n, 0), 1);
  assert.equal(r.p50Ms, 500, "o erro sem duração não puxou o p50 para o primeiro balde");
});

test("balde vencido some: depois de 60 minutos a amostra não aparece mais", () => {
  const { registro, relogio } = comRelogio();
  registro.registrar({ host: "a.com", grupo: "busca", status: 200, duracaoMs: 10 });
  relogio.agora += 59 * MINUTO;
  assert.equal(registro.resumo().hosts["a.com"].busca!.requisicoes, 1);
  relogio.agora += MINUTO;
  assert.deepEqual(registro.resumo().hosts, {});
});

test("a janela pedida corta o que é mais antigo que ela", () => {
  const { registro, relogio } = comRelogio();
  registro.registrar({ host: "a.com", grupo: "busca", status: 200, duracaoMs: 10 });
  relogio.agora += 10 * MINUTO;
  registro.registrar({ host: "a.com", grupo: "busca", status: 200, duracaoMs: 10 });
  assert.equal(registro.resumo({ minutos: 5 }).hosts["a.com"].busca!.requisicoes, 1);
  assert.equal(registro.resumo({ minutos: 60 }).hosts["a.com"].busca!.requisicoes, 2);
  assert.equal(registro.resumo({ minutos: 5 }).janelaMinutos, 5);
  assert.equal(registro.resumo({ minutos: 999 }).janelaMinutos, 60);
});

test("teto de hosts: o excedente soma em _outros, e host já conhecido segue contando no nome dele", () => {
  const { registro } = comRelogio();
  for (let i = 0; i < MAXIMO_DE_HOSTS + 30; i++) registro.registrar({ host: `h${i}.forjado.test`, grupo: "busca", status: 200, duracaoMs: 10 });
  registro.registrar({ host: "h0.forjado.test", grupo: "busca", status: 200, duracaoMs: 10 });
  const hosts = registro.resumo().hosts;
  assert.equal(Object.keys(hosts).length, MAXIMO_DE_HOSTS + 1);
  assert.equal(hosts[HOST_OUTROS].busca!.requisicoes, 30);
  assert.equal(hosts["h0.forjado.test"].busca!.requisicoes, 2);
});

test("teto de hosts libera a vaga de quem parou de aparecer há mais de 60 minutos", () => {
  const { registro, relogio } = comRelogio();
  for (let i = 0; i < MAXIMO_DE_HOSTS; i++) registro.registrar({ host: `h${i}.forjado.test`, grupo: "busca", status: 200, duracaoMs: 10 });
  relogio.agora += 61 * MINUTO;
  registro.registrar({ host: "loja-nova.com.br", grupo: "busca", status: 200, duracaoMs: 10 });
  assert.deepEqual(Object.keys(registro.resumo().hosts), ["loja-nova.com.br"]);
});

test("chaveDoHost dá o mesmo que normalizarHost nos casos sem www, e tira o www", () => {
  for (const host of ["Loja.Lojas.AvilaOps.com", "loja.com.br:3080", "loja.com.br.", "LOJA.com.br.:443", "demo.localhost:3099"]) {
    assert.equal(chaveDoHost(host), normalizarHost(host), host);
  }
  assert.equal(chaveDoHost("www.Loja.com.br:443"), "loja.com.br");
  assert.equal(chaveDoHost(""), HOST_SEM_HOST);
  assert.equal(chaveDoHost(null), HOST_SEM_HOST);
  assert.equal(chaveDoHost(undefined), HOST_SEM_HOST);
});

test("host com caixa, porta e www diferentes cai na mesma chave", () => {
  const { registro } = comRelogio();
  for (const host of ["Loja.com.br", "loja.com.br:443", "www.loja.com.br"]) registro.registrar({ host, grupo: "busca", status: 200, duracaoMs: 10 });
  assert.equal(registro.resumo().hosts["loja.com.br"].busca!.requisicoes, 3);
});

test("registroGlobal devolve sempre a mesma instância, presa no globalThis", () => {
  assert.equal(registroGlobal(), registroGlobal());
  assert.equal((globalThis as unknown as Record<symbol, unknown>)[Symbol.for("lojas.metricas")], registroGlobal());
  assert.ok(registroGlobal().processoDesde <= Date.now() && registroGlobal().processoDesde > Date.now() - 3_600_000, "conta desde a subida do processo");
});

test("a lista de grupos é a fechada da especificação", () => {
  assert.deepEqual([...GRUPOS], ["checkout", "frete", "busca", "webhook", "api-v1", "render", "acao", "outra"]);
});
