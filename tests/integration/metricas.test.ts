import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { PedidoStatus } from "@prisma/client";
import { prisma } from "../../src/lib/db";
import { lerNegocio24h } from "../../src/lib/metricas-negocio";
import { montarRelatorioDeMetricas, type RelatorioDeMetricas } from "../../src/lib/metricas-relatorio";
import { RegistroDeMetricas, registroGlobal } from "../../src/lib/metricas-tenant";
import { GET as getMetricas } from "../../src/app/api/admin/metricas/route";

/**
 * Métricas por loja contra o Postgres de verdade: os números de negócio de
 * uma loja não aparecem na outra, a conversão só conta pedido com sessão e o
 * que é mais velho que 24 h fica de fora.
 */

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
after(() => prisma.$disconnect());

const sufixo = () => randomUUID().replace(/-/g, "");
const HORA = 3_600_000;

async function loja(dominios: string[] = []) {
  return prisma.tenant.create({ data: { slug: `qa-met-${sufixo()}`, nome: "QA Métricas", status: "ATIVA", dominios } });
}

async function sessao(tenantId: string, criadoEm = new Date()) {
  return prisma.sessaoVitrine.create({ data: { tenantId, chave: sufixo(), visitante: sufixo(), canal: "direto", entrada: "/", criadoEm } });
}

async function pedido(tenantId: string, status: PedidoStatus, extras: { sessaoId?: string; criadoEm?: Date; canal?: string } = {}) {
  return prisma.pedido.create({
    data: {
      tenantId, referencia: `QA-${sufixo()}`, status, clienteNome: "QA", clienteEmail: "qa@example.test",
      clienteTelefone: "5511999999999", clienteDocumento: "00000000000", freteNome: "Retirada", freteCentavos: 0,
      subtotalCentavos: 4990, totalCentavos: 4990, meioPagamento: "pix", ...extras,
    },
  });
}

test("os números de negócio de uma loja não aparecem na outra", async () => {
  const agora = new Date();
  const [a, b, vazia] = await Promise.all([loja(), loja(), loja()]);

  // Loja A: 4 sessões nas 24 h, 1 antiga; 2 pagos com sessão, 1 pago de marketplace, 1 aguardando, 1 cancelado, 1 pago antigo.
  const sessoesA = await Promise.all([sessao(a.id), sessao(a.id), sessao(a.id), sessao(a.id), sessao(a.id, new Date(agora.getTime() - 30 * HORA))]);
  await pedido(a.id, "PAGO", { sessaoId: sessoesA[0].id });
  await pedido(a.id, "ENVIADO", { sessaoId: sessoesA[1].id });
  await pedido(a.id, "PAGO", { canal: "mercadolivre" });
  await pedido(a.id, "AGUARDANDO_PAGAMENTO", { sessaoId: sessoesA[2].id });
  await pedido(a.id, "CANCELADO");
  await pedido(a.id, "PAGO", { sessaoId: sessoesA[4].id, criadoEm: new Date(agora.getTime() - 30 * HORA) });

  // Loja B: 1 sessão, 1 pedido pago com sessão.
  const sessaoB = await sessao(b.id);
  await pedido(b.id, "ENTREGUE", { sessaoId: sessaoB.id });

  const { lojas, negocio } = await lerNegocio24h(agora, [a.id, b.id, vazia.id]);
  assert.deepEqual(lojas.map((l) => l.id).sort(), [a.id, b.id, vazia.id].sort());
  assert.deepEqual(negocio.get(a.id), { sessoes: 4, pedidosCriados: 5, pedidosPagos: 3, pedidosPagosComSessao: 2 });
  assert.deepEqual(negocio.get(b.id), { sessoes: 1, pedidosCriados: 1, pedidosPagos: 1, pedidosPagosComSessao: 1 });
  assert.equal(negocio.get(vazia.id), undefined);

  const relatorio = montarRelatorioDeMetricas(new RegistroDeMetricas().resumo(), lojas, negocio, agora);
  const de = (slug: string) => relatorio.lojas.find((l) => l.slug === slug)!.negocio24h;
  assert.deepEqual(de(a.slug), { sessoes: 4, pedidosCriados: 5, pedidosPagos: 3, conversao: 50 });
  assert.deepEqual(de(b.slug), { sessoes: 1, pedidosCriados: 1, pedidosPagos: 1, conversao: 100 });
  assert.deepEqual(de(vazia.slug), { sessoes: 0, pedidosCriados: 0, pedidosPagos: 0, conversao: null });
});

test("a rota exige o token, valida a janela e casa a operação com a loja pelo host", async () => {
  process.env.LOJAS_ADMIN_TOKEN = `qa-${sufixo()}`;
  const base = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();
  const dominio = `qa-${sufixo()}.example.test`;
  const [a, b] = await Promise.all([loja([dominio]), loja()]);
  await sessao(a.id);

  const chamar = (caminho: string, token?: string) =>
    getMetricas(new Request(`https://${base}${caminho}`, { headers: token ? { authorization: `Bearer ${token}` } : {} }));

  assert.equal((await chamar("/api/admin/metricas")).status, 401);
  assert.equal((await chamar("/api/admin/metricas", "token-errado")).status, 401);
  for (const ruim of ["0", "61", "abc", "1.5", "-3", ""]) {
    assert.equal((await chamar(`/api/admin/metricas?minutos=${ruim}`, process.env.LOJAS_ADMIN_TOKEN)).status, 400, `minutos=${ruim}`);
  }

  // Direto no registro do processo, que é o que a rota lê: `/api/busca` depende
  // de `headers()` do Next e só responde dentro do servidor (conferência HTTP em docs/METRICAS.md).
  for (const host of [`${a.slug}.${base}`, `WWW.${dominio}:443`]) {
    registroGlobal().registrar({ host, grupo: "busca", status: 200, duracaoMs: 40 });
  }
  registroGlobal().registrar({ host: `${b.slug}.${base}`, grupo: "checkout", status: 503, duracaoMs: 120 });

  const resposta = await chamar("/api/admin/metricas?minutos=5", process.env.LOJAS_ADMIN_TOKEN);
  assert.equal(resposta.status, 200);
  assert.equal(resposta.headers.get("cache-control"), "no-store");
  const corpo = (await resposta.json()) as RelatorioDeMetricas;
  assert.equal(corpo.janelaMinutos, 5);

  const lojaA = corpo.lojas.find((l) => l.slug === a.slug)!;
  const lojaB = corpo.lojas.find((l) => l.slug === b.slug)!;
  assert.equal(lojaA.operacao.porGrupo.busca!.requisicoes, 2, "subdomínio e domínio próprio somaram na loja A");
  assert.equal(lojaA.operacao.porGrupo.busca!.p50Ms, 50);
  assert.equal(lojaA.operacao.taxaErro, 0);
  assert.equal(lojaA.operacao.porGrupo.checkout, undefined, "o erro da loja B não aparece na A");
  assert.equal(lojaA.negocio24h.sessoes, 1);
  assert.deepEqual(lojaB.operacao.porGrupo.checkout, { requisicoes: 1, erros: 1, p50Ms: 250, p95Ms: 250 });
  assert.equal(lojaB.operacao.taxaErro, 100);
  assert.equal(lojaB.operacao.porGrupo.busca, undefined);
  assert.deepEqual(lojaB.negocio24h, { sessoes: 0, pedidosCriados: 0, pedidosPagos: 0, conversao: null });
});
