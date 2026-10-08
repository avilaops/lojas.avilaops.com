import assert from "node:assert/strict";
import test from "node:test";
import { montarRelatorioDeMetricas, percentual, type LojaDoRelatorio, type Negocio24h } from "./metricas-relatorio";
import { HOST_OUTROS, HOST_SEM_LOJA, RegistroDeMetricas } from "./metricas-tenant";

const BASE = "lojas.avilaops.com";
const AGORA = new Date("2026-10-07T12:00:00.000Z");

const brasa: LojaDoRelatorio = { id: "t-brasa", slug: "brasa", nome: "Brasa", status: "ATIVA", dominios: ["brasa.com.br", "www.brasa.com.br"] };
const aurora: LojaDoRelatorio = { id: "t-aurora", slug: "aurora", nome: "Aurora", status: "ATIVA", dominios: [] };
const antiga: LojaDoRelatorio = { id: "t-antiga", slug: "antiga", nome: "Antiga", status: "CANCELADA", dominios: [] };
const suspensa: LojaDoRelatorio = { id: "t-suspensa", slug: "suspensa", nome: "Suspensa", status: "SUSPENSA", dominios: ["suspensa.com.br"] };

function negocio(dados: Record<string, Partial<Negocio24h>>): Map<string, Negocio24h> {
  return new Map(Object.entries(dados).map(([id, n]) => [id, { sessoes: 0, pedidosCriados: 0, pedidosPagos: 0, pedidosPagosComSessao: 0, ...n }]));
}

function registroCom(amostras: Array<[host: string, grupo: "busca" | "checkout" | "frete", status: number, duracaoMs: number]>) {
  const registro = new RegistroDeMetricas(() => AGORA.getTime());
  for (const [host, grupo, status, duracaoMs] of amostras) registro.registrar({ host, grupo, status, duracaoMs });
  return registro;
}

test("subdomínio e domínio próprio somam na mesma loja, e o percentil sai da soma", () => {
  const registro = registroCom([
    ["brasa.lojas.avilaops.com", "busca", 200, 20],
    ["brasa.com.br", "busca", 200, 20],
    ["www.brasa.com.br:443", "busca", 500, 800],
    ["brasa.com.br", "checkout", 200, 300],
  ]);
  const r = montarRelatorioDeMetricas(registro.resumo(), [brasa, aurora], negocio({}), AGORA, BASE);
  const loja = r.lojas.find((l) => l.slug === "brasa")!;
  assert.deepEqual(loja.operacao.porGrupo.busca, { requisicoes: 3, erros: 1, p50Ms: 25, p95Ms: 1000 });
  assert.deepEqual(loja.operacao.porGrupo.checkout, { requisicoes: 1, erros: 0, p50Ms: 500, p95Ms: 500 });
  assert.equal(loja.operacao.requisicoes, 4);
  assert.equal(loja.operacao.erros, 1);
  assert.equal(loja.operacao.taxaErro, 25);
  assert.deepEqual(r.semLoja, { requisicoes: 0, erros: 0, taxaErro: null, porGrupo: {} });
});

test("host desconhecido, _outros e _sem-loja vão para semLoja, somados e sem o nome do host", () => {
  const registro = registroCom([
    ["atacante.example.com", "busca", 200, 10],
    ["naoexiste.lojas.avilaops.com", "busca", 500, 10],
    ["a.b.lojas.avilaops.com", "busca", 200, 10],
    [HOST_OUTROS, "busca", 200, 10],
    [HOST_SEM_LOJA, "busca", 200, 10],
    ["aurora.lojas.avilaops.com", "busca", 200, 10],
  ]);
  const r = montarRelatorioDeMetricas(registro.resumo(), [brasa, aurora], negocio({}), AGORA, BASE);
  assert.equal(r.semLoja.requisicoes, 5);
  assert.equal(r.semLoja.erros, 1);
  assert.equal(r.semLoja.taxaErro, 20);
  assert.equal(r.lojas.find((l) => l.slug === "aurora")!.operacao.requisicoes, 1);
  const texto = JSON.stringify(r);
  for (const host of ["atacante.example.com", "naoexiste", HOST_OUTROS, HOST_SEM_LOJA]) assert.equal(texto.includes(host), false, host);
});

test("denominador zero dá null, nunca zero", () => {
  assert.equal(percentual(0, 0), null);
  assert.equal(percentual(0, 8), 0);
  assert.equal(percentual(1, 3), 33.3);
  const r = montarRelatorioDeMetricas(new RegistroDeMetricas().resumo(), [aurora], negocio({ "t-aurora": { pedidosCriados: 2, pedidosPagos: 1 } }), AGORA, BASE);
  const loja = r.lojas[0];
  assert.equal(loja.operacao.taxaErro, null, "sem requisição não há taxa de erro");
  assert.equal(loja.negocio24h.conversao, null, "sem sessão não há conversão, mesmo com pedido");
  assert.deepEqual(loja.operacao.porGrupo, {});
  assert.equal(loja.negocio24h.pedidosPagos, 1);
});

test("pedido sem sessão conta em pedidosPagos e não na conversão", () => {
  const r = montarRelatorioDeMetricas(
    new RegistroDeMetricas().resumo(),
    [aurora],
    negocio({ "t-aurora": { sessoes: 40, pedidosCriados: 7, pedidosPagos: 5, pedidosPagosComSessao: 3 } }),
    AGORA,
    BASE,
  );
  assert.deepEqual(r.lojas[0].negocio24h, { sessoes: 40, pedidosCriados: 7, pedidosPagos: 5, conversao: 7.5 });
});

test("entram as ATIVAS e as outras só quando tiveram requisição; a ordem é por slug", () => {
  const registro = registroCom([["suspensa.com.br", "checkout", 403, 30]]);
  const r = montarRelatorioDeMetricas(registro.resumo(), [suspensa, brasa, antiga, aurora], negocio({}), AGORA, BASE);
  assert.deepEqual(r.lojas.map((l) => l.slug), ["aurora", "brasa", "suspensa"]);
  assert.equal(r.lojas[2].status, "SUSPENSA");
});

test("o topo diz quando foi medido, desde quando o processo conta e a janela", () => {
  const nascimento = AGORA.getTime() - 15 * 60_000;
  const relogio = { agora: nascimento };
  const registro = new RegistroDeMetricas(() => relogio.agora);
  relogio.agora = AGORA.getTime();
  const r = montarRelatorioDeMetricas(registro.resumo({ minutos: 30 }), [], negocio({}), AGORA, BASE);
  assert.equal(r.medidoEm, "2026-10-07T12:00:00.000Z");
  assert.equal(r.processoDesde, "2026-10-07T11:45:00.000Z");
  assert.equal(r.janelaMinutos, 30);
});

test("percentil acima de 5000 ms sai marcado como teto", () => {
  const registro = registroCom([["aurora.lojas.avilaops.com", "frete", 200, 9000]]);
  const r = montarRelatorioDeMetricas(registro.resumo(), [aurora], negocio({}), AGORA, BASE);
  assert.deepEqual(r.lojas[0].operacao.porGrupo.frete, { requisicoes: 1, erros: 0, p50Ms: 5000, p95Ms: 5000, acimaDoTeto: true });
});

test("o relatório não leva o histograma nem o id interno da loja", () => {
  const registro = registroCom([["aurora.lojas.avilaops.com", "busca", 200, 10]]);
  const texto = JSON.stringify(montarRelatorioDeMetricas(registro.resumo(), [aurora], negocio({}), AGORA, BASE));
  assert.equal(texto.includes("histograma"), false);
  assert.equal(texto.includes("t-aurora"), false);
});
