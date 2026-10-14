import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { chaveDaNotificacao, processarNotificacao } from "../../src/lib/webhook-pagamentos";

/** Trava de idempotência do webhook genérico, contra o Postgres de verdade. */

process.env.LOJAS_SECRET ??= "0".repeat(64);
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
after(() => prisma.$disconnect());
const sufixo = () => randomUUID().replace(/-/g, "").slice(0, 10);

test("o mesmo fato chega duas vezes (e ao mesmo tempo): processa uma", async () => {
  const t = await prisma.tenant.create({ data: { slug: `qa-wh-${sufixo()}`, nome: "QA WH", status: "ATIVA" } });
  const n = { pagamentoId: `pg-${sufixo()}`, status: "aprovado", valorEmCentavos: 1234 };
  const [a, b] = await Promise.all([processarNotificacao(t, { provedor: "pagbank" }, n), processarNotificacao(t, { provedor: "pagbank" }, n)]);
  assert.deepEqual([a, b].sort(), ["processada", "repetida"]);
  assert.equal(await processarNotificacao(t, { provedor: "pagbank" }, n), "repetida");
  const ev = await prisma.cobrancaEvento.findUnique({ where: { notificacaoId: chaveDaNotificacao("pagbank", n.pagamentoId, "aprovado", 1234) } });
  assert.ok(ev?.processadoEm);
  // Fato novo do mesmo pagamento (estorno) passa.
  assert.equal(await processarNotificacao(t, { provedor: "pagbank" }, { ...n, status: "estornado" }), "processada");
});
