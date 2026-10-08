import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { cifrar } from "../../src/lib/cofre";
import { emitir, lojista } from "../../src/lib/eventos";
import { mudarStatusDoPedido } from "../../src/lib/pedidos-status";
import { FALHAS_ATE_DESLIGAR, TENTATIVAS_MAXIMAS, conferirAssinatura, type EventoDeWebhook } from "../../src/lib/webhooks-api";
import { entregarWebhooks, type Enviar } from "../../src/lib/webhooks-entrega";

/**
 * Webhooks da API contra o Postgres: o que entra na fila, para quem, e o que
 * acontece quando o destino não responde. O envio é injetado: nenhum teste
 * requisita endereço de verdade.
 */

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
process.env.LOJAS_SECRET ??= "0".repeat(64);
delete process.env.N8N_WEBHOOK_URL;
after(() => prisma.$disconnect());

const sufixo = () => randomUUID().replace(/-/g, "");
const SEGREDO = "whsec_teste";
const loja = () => prisma.tenant.create({ data: { slug: `qa-wh-${sufixo()}`, nome: "QA Webhooks", status: "ATIVA", plano: "LOJA_PRO" } });
const webhook = (tenantId: string, eventos: EventoDeWebhook[], extras: { ativo?: boolean; url?: string } = {}) =>
  prisma.webhookApi.create({ data: { tenantId, nome: "ERP", url: extras.url ?? `https://erp-${sufixo()}.example/webhook`, eventos, segredoEnc: cifrar(SEGREDO), ativo: extras.ativo ?? true } });
const pedido = (tenantId: string) =>
  prisma.pedido.create({
    data: {
      tenantId, referencia: sufixo(), clienteNome: "Cliente QA", clienteEmail: "cliente@example.test", clienteTelefone: "5511999999999",
      clienteDocumento: "00000000000", freteNome: "Transportadora QA", freteCentavos: 0, subtotalCentavos: 4990, totalCentavos: 4990,
      meioPagamento: "pix", status: "PAGO",
    },
  });

/** Um destino de mentira que anota o que recebeu e responde o que o teste mandar. */
function destino(responder: (url: string) => number | Error = () => 200) {
  const recebidos: Array<{ url: string; corpo: string; cabecalhos: Record<string, string> }> = [];
  const enviar: Enviar = async (u, corpo, cabecalhos) => {
    recebidos.push({ url: u, corpo, cabecalhos });
    const r = responder(u);
    if (r instanceof Error) throw r;
    return { status: r };
  };
  return { recebidos, enviar };
}

/** Só as entregas desta loja: a fila é da plataforma inteira, e outros testes também a enchem. */
const daLoja = (tenantId: string) => prisma.entregaWebhook.findMany({ where: { tenantId }, orderBy: { criadaEm: "asc" } });

test("pedido enviado entra na fila de quem assinou, com o pedido da API e sem contato do lojista", async () => {
  const t = await prisma.tenant.update({ where: { id: (await loja()).id }, data: { whatsapp: "5516988887777", loginEmail: `dono-${sufixo()}@segredo.example` } });
  const assinou = await webhook(t.id, ["pedido.enviado"]);
  await webhook(t.id, ["pedido.pago"]);
  await webhook(t.id, ["pedido.enviado"], { ativo: false });
  const p = await pedido(t.id);

  await mudarStatusDoPedido(t, p.id, { status: "ENVIADO", rastreio: "BR123456789BR" });

  const fila = await daLoja(t.id);
  assert.equal(fila.length, 1);
  assert.equal(fila[0].webhookId, assinou.id);
  assert.equal(fila[0].tipo, "pedido.enviado");
  const corpo = fila[0].corpo as { id: string; tipo: string; dados: { pedido: Record<string, unknown> } };
  assert.equal(corpo.tipo, "pedido.enviado");
  assert.equal(corpo.id, fila[0].eventId);
  assert.equal(corpo.dados.pedido.referencia, p.referencia);
  assert.equal(corpo.dados.pedido.status, "ENVIADO");
  // O envelope interno do evento leva o contato do lojista; o webhook não.
  const texto = JSON.stringify(corpo);
  for (const interno of ["segredo.example", "5516988887777", "lojistaEmail", "lojistaWhatsapp"]) assert.equal(texto.includes(interno), false, interno);
});

test("o mesmo fato emitido de novo não entra duas vezes na fila", async () => {
  const t = await loja();
  await webhook(t.id, ["pedido.enviado"]);
  const p = await pedido(t.id);

  await Promise.all([
    mudarStatusDoPedido(t, p.id, { status: "ENVIADO" }),
    mudarStatusDoPedido(t, p.id, { status: "ENVIADO" }),
    mudarStatusDoPedido(t, p.id, { status: "ENVIADO" }),
  ]);
  assert.equal((await daLoja(t.id)).length, 1);
});

test("evento que não é contrato e webhook de outra loja ficam de fora", async () => {
  const [a, b] = [await loja(), await loja()];
  await webhook(a.id, ["pedido.pago", "pedido.enviado"]);
  await webhook(b.id, ["pedido.pago", "pedido.enviado"]);
  const p = await pedido(a.id);

  await emitir({ tipo: "loja.reativada", slug: a.slug, nome: a.nome, url: "https://qa.example", emailContato: null, whatsapp: null });
  await emitir({ tipo: "operacao.alerta", slug: a.slug, lojaNome: a.nome, codigo: "x", recurso: "y", oQueQuebrou: "z", oQueFazer: "w", detalhe: "", link: null });
  assert.equal((await daLoja(a.id)).length, 0);

  await emitir({
    tipo: "pedido.pago", slug: a.slug, referencia: p.referencia, numero: p.numero, totalCentavos: 4990, clienteNome: "c", clienteEmail: "c@example.test",
    clienteTelefone: "1", itens: [], itensTexto: "", ...lojista(a),
  });
  assert.equal((await daLoja(a.id)).length, 1);
  assert.equal((await daLoja(b.id)).length, 0);
});

test("entrega com sucesso: assinatura confere, cabeçalhos certos, e não envia de novo", async () => {
  const t = await loja();
  const w = await webhook(t.id, ["pedido.enviado"]);
  const p = await pedido(t.id);
  await mudarStatusDoPedido(t, p.id, { status: "ENVIADO" });
  const d = destino();

  await entregarWebhooks({ enviar: d.enviar });
  const meus = d.recebidos.filter((r) => r.url === w.url);
  assert.equal(meus.length, 1);
  assert.equal(meus[0].cabecalhos["x-lojas-evento"], "pedido.enviado");
  assert.equal(conferirAssinatura(SEGREDO, meus[0].corpo, meus[0].cabecalhos["x-lojas-assinatura"]), true);
  assert.equal(conferirAssinatura("whsec_outro", meus[0].corpo, meus[0].cabecalhos["x-lojas-assinatura"]), false);

  const [entrega] = await daLoja(t.id);
  assert.equal(entrega.status, "ENTREGUE");
  assert.equal(entrega.ultimoStatus, 200);
  assert.equal(meus[0].cabecalhos["x-lojas-entrega"], entrega.id);
  assert.ok((await prisma.webhookApi.findUniqueOrThrow({ where: { id: w.id } })).ultimaEntregaEm);

  await entregarWebhooks({ enviar: d.enviar });
  assert.equal(d.recebidos.filter((r) => r.url === w.url).length, 1);
});

test("duas passadas ao mesmo tempo enviam a entrega uma vez", async () => {
  const t = await loja();
  const w = await webhook(t.id, ["pedido.enviado"]);
  await mudarStatusDoPedido(t, (await pedido(t.id)).id, { status: "ENVIADO" });
  const d = destino();

  await Promise.all([entregarWebhooks({ enviar: d.enviar }), entregarWebhooks({ enviar: d.enviar }), entregarWebhooks({ enviar: d.enviar })]);
  assert.equal(d.recebidos.filter((r) => r.url === w.url).length, 1);
});

test("destino fora do ar: adia com o erro anotado, tenta de novo no prazo e entrega quando volta", async () => {
  const t = await loja();
  const w = await webhook(t.id, ["pedido.enviado"]);
  await mudarStatusDoPedido(t, (await pedido(t.id)).id, { status: "ENVIADO" });
  let noAr = false;
  const d = destino((u) => (u !== w.url ? 200 : noAr ? 204 : 503));
  const agora = new Date();

  await entregarWebhooks({ enviar: d.enviar, agora });
  let [e] = await daLoja(t.id);
  assert.equal(e.status, "PENDENTE");
  assert.equal(e.tentativas, 1);
  assert.equal(e.ultimoStatus, 503);
  assert.match(String(e.ultimoErro), /503/);
  assert.equal(e.proximaEm.getTime(), agora.getTime() + 60_000);

  // Antes do prazo não tenta; depois, sim.
  await entregarWebhooks({ enviar: d.enviar, agora: new Date(agora.getTime() + 30_000) });
  assert.equal(d.recebidos.filter((r) => r.url === w.url).length, 1);

  noAr = true;
  await entregarWebhooks({ enviar: d.enviar, agora: new Date(agora.getTime() + 61_000) });
  [e] = await daLoja(t.id);
  assert.equal(e.status, "ENTREGUE");
  assert.equal(e.tentativas, 2);
  assert.equal(e.ultimoErro, null);
});

test("destino que nunca responde: a entrega esgota, e o webhook é desligado depois de muitas", async () => {
  const t = await loja();
  const w = await webhook(t.id, ["pedido.enviado"]);
  await mudarStatusDoPedido(t, (await pedido(t.id)).id, { status: "ENVIADO" });
  const d = destino((u) => (u === w.url ? new Error("connect ECONNREFUSED") : 200));

  let agora = new Date();
  for (let i = 0; i < TENTATIVAS_MAXIMAS; i++) {
    await entregarWebhooks({ enviar: d.enviar, agora });
    agora = new Date(agora.getTime() + 1000 * 60 * 1000);
  }
  const [e] = await daLoja(t.id);
  assert.equal(e.status, "FALHOU");
  assert.equal(e.tentativas, TENTATIVAS_MAXIMAS);
  assert.match(String(e.ultimoErro), /ECONNREFUSED/);
  assert.equal(d.recebidos.filter((r) => r.url === w.url).length, TENTATIVAS_MAXIMAS);
  let estado = await prisma.webhookApi.findUniqueOrThrow({ where: { id: w.id } });
  assert.equal(estado.falhasSeguidas, 1);
  assert.equal(estado.ativo, true);

  // À beira do limite, mais uma entrega esgotada desliga.
  await prisma.webhookApi.update({ where: { id: w.id }, data: { falhasSeguidas: FALHAS_ATE_DESLIGAR - 1 } });
  await prisma.entregaWebhook.create({ data: { webhookId: w.id, tenantId: t.id, eventId: `evt_${sufixo()}`, tipo: "pedido.enviado", corpo: {}, tentativas: TENTATIVAS_MAXIMAS - 1 } });
  await entregarWebhooks({ enviar: d.enviar, agora });
  estado = await prisma.webhookApi.findUniqueOrThrow({ where: { id: w.id } });
  assert.equal(estado.ativo, false);
  assert.match(String(estado.desligadoMotivo), /ECONNREFUSED/);

  // Desligado não recebe nem o que ficou na fila.
  await prisma.entregaWebhook.create({ data: { webhookId: w.id, tenantId: t.id, eventId: `evt_${sufixo()}`, tipo: "pedido.enviado", corpo: {} } });
  const antes = d.recebidos.length;
  await entregarWebhooks({ enviar: d.enviar, agora });
  assert.equal(d.recebidos.filter((r) => r.url === w.url).length, d.recebidos.slice(0, antes).filter((r) => r.url === w.url).length);
});

test("o envio de verdade recusa endereço interno antes de abrir conexão", async () => {
  const { enviarPorHttp } = await import("../../src/lib/webhooks-entrega");
  for (const u of ["http://erp.example/webhook", "https://127.0.0.1/x", "https://localhost/x", "https://servico.internal/x"]) {
    await assert.rejects(enviarPorHttp(u, "{}", {}), Error, u);
  }
});
