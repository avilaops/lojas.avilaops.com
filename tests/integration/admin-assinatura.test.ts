import { after, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { processarNotificacao } from "../../src/lib/assinatura";
import { POST as assinatura } from "../../src/app/api/admin/tenants/[slug]/assinatura/route";
import { GET as lerIsencao, POST as mudarIsencao } from "../../src/app/api/admin/tenants/[slug]/isencao/route";

/**
 * A mensalidade de uma loja de ponta a ponta — criar, alterar, pausar, retomar,
 * cancelar, receber aviso de pagamento — e a isenção, contra o Postgres.
 *
 * **Nenhuma chamada sai para o Mercado Pago.** O `fetch` é trocado por um
 * Mercado Pago de mentira, em memória, e qualquer requisição para outro
 * endereço derruba o teste. O token é fictício. Nada aqui cobra ninguém.
 */

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
delete process.env.N8N_WEBHOOK_URL;
delete process.env.LOJAS_SUSPENSAO_AUTOMATICA;
process.env.LOJAS_ADMIN_TOKEN = "token-de-teste-do-admin";
process.env.MP_ACCESS_TOKEN = "TEST-token-ficticio-nao-cobra-ninguem";
after(() => prisma.$disconnect());

type Pre = { id: string; status: string; init_point?: string; external_reference?: string; auto_recurring: { transaction_amount: number } };
const mp = {
  preapprovals: new Map<string, Pre>(),
  pagamentos: new Map<string, { id: number; preapproval_id: string; status: string; transaction_amount: number; payment?: { status: string } }>(),
  chamadas: [] as Array<{ metodo: string; caminho: string; corpo: unknown }>,
  /** Faz a próxima alteração de assinatura falhar, como o Mercado Pago fora do ar. */
  falharAlteracao: false,
};
const json = (status: number, corpo: unknown) => new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });

globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
  const u = new URL(typeof entrada === "string" || entrada instanceof URL ? entrada : entrada.url);
  if (u.origin !== "https://api.mercadopago.com") throw new Error(`o teste tentou sair para ${u.origin}: nada aqui pode falar com a rede`);
  const metodo = init?.method ?? "GET";
  const corpo = init?.body ? JSON.parse(String(init.body)) : undefined;
  mp.chamadas.push({ metodo, caminho: u.pathname, corpo });

  if (metodo === "POST" && u.pathname === "/preapproval") {
    const id = `pre-${randomUUID().slice(0, 8)}`;
    const pre: Pre = { id, status: "pending", init_point: `https://mp.exemplo/assinar/${id}`, external_reference: corpo.external_reference, auto_recurring: { transaction_amount: corpo.auto_recurring.transaction_amount } };
    mp.preapprovals.set(id, pre);
    return json(201, pre);
  }
  const pre = u.pathname.match(/^\/preapproval\/(.+)$/);
  if (pre) {
    const atual = mp.preapprovals.get(pre[1]);
    if (!atual) return json(404, { message: "preapproval não encontrada" });
    if (metodo === "GET") return json(200, atual);
    if (mp.falharAlteracao) { mp.falharAlteracao = false; return json(503, { message: "Mercado Pago indisponível" }); }
    if (corpo.status) atual.status = corpo.status;
    if (corpo.auto_recurring) atual.auto_recurring.transaction_amount = corpo.auto_recurring.transaction_amount;
    return json(200, atual);
  }
  const pg = u.pathname.match(/^\/authorized_payments\/(.+)$/);
  if (pg) { const p = mp.pagamentos.get(pg[1]); return p ? json(200, p) : json(404, { message: "pagamento não encontrado" }); }
  return json(404, { message: `rota não prevista no Mercado Pago de mentira: ${metodo} ${u.pathname}` });
}) as typeof fetch;

beforeEach(() => { mp.chamadas.length = 0; mp.falharAlteracao = false; });

const sufixo = () => randomUUID().replace(/-/g, "").slice(0, 12);
const loja = (dados: Record<string, unknown> = {}) =>
  prisma.tenant.create({ data: { slug: `qa-ass-${sufixo()}`, nome: "QA Assinatura", status: "ATIVA", plano: "LOJA_PRO", loginEmail: `dono-${sufixo()}@example.test`, ...dados } });
const atual = (id: string) => prisma.tenant.findUniqueOrThrow({ where: { id } });
const criacoes = () => mp.chamadas.filter((c) => c.metodo === "POST" && c.caminho === "/preapproval").length;

async function agir(slug: string, corpo: unknown) {
  const r = await assinatura(
    new Request(`https://lojas.avilaops.com/api/admin/tenants/${slug}/assinatura`, { method: "POST", headers: { authorization: "Bearer token-de-teste-do-admin", "content-type": "application/json" }, body: JSON.stringify(corpo) }),
    { params: Promise.resolve({ slug }) },
  );
  return { status: r.status, corpo: (await r.json()) as { erro?: string; initPoint?: string | null; assinaturaStatus?: string; assinaturaId?: string | null } };
}
async function isencao(slug: string, corpo?: unknown) {
  const req = new Request(`https://lojas.avilaops.com/api/admin/tenants/${slug}/isencao`, {
    method: corpo === undefined ? "GET" : "POST",
    headers: { authorization: "Bearer token-de-teste-do-admin", "content-type": "application/json" },
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  });
  const r = await (corpo === undefined ? lerIsencao : mudarIsencao)(req, { params: Promise.resolve({ slug }) });
  return { status: r.status, corpo: (await r.json()) as { erro?: string; mudou?: boolean; precisaDeCiencia?: boolean; isenta?: boolean; seNaoFosseIsenta?: string | null; depois?: { isenta: boolean } } };
}

test("criar a mensalidade: nasce pendente, com o valor do plano e o link de cartão — e nada é marcado como pago", async () => {
  const t = await loja();
  const r = await agir(t.slug, { acao: "iniciar" });
  assert.equal(r.status, 200);
  assert.match(r.corpo.initPoint ?? "", /^https:\/\/mp\.exemplo\/assinar\/pre-/);

  const gravada = await atual(t.id);
  assert.deepEqual(
    { status: gravada.assinaturaStatus, temId: Boolean(gravada.assinaturaId), link: gravada.assinaturaInitPoint, pago: gravada.ultimoPagamentoEm, loja: gravada.status },
    { status: "PENDENTE", temId: true, link: r.corpo.initPoint, pago: null, loja: "ATIVA" },
  );
  const pedido = mp.chamadas.find((c) => c.metodo === "POST")!.corpo as { external_reference: string; payer_email: string; auto_recurring: { transaction_amount: number; frequency_type: string } };
  assert.deepEqual({ ref: pedido.external_reference, email: pedido.payer_email, valor: pedido.auto_recurring.transaction_amount, ciclo: pedido.auto_recurring.frequency_type }, { ref: t.slug, email: t.loginEmail, valor: 497, ciclo: "months" });
  assert.equal(await prisma.fatura.count({ where: { tenantId: t.id } }), 0);
});

test("pedir de novo não cria segunda assinatura: reaproveita a pendente e devolve o mesmo link", async () => {
  const t = await loja();
  const primeira = await agir(t.slug, { acao: "iniciar" });
  const segunda = await agir(t.slug, { acao: "iniciar" });
  const terceira = await agir(t.slug, { acao: "iniciar" });
  assert.equal(criacoes(), 1);
  assert.deepEqual([segunda.corpo.initPoint, terceira.corpo.initPoint], [primeira.corpo.initPoint, primeira.corpo.initPoint]);
  assert.equal(mp.preapprovals.size >= 1, true);
});

test("não cria para loja isenta, cancelada ou sem e-mail de login — e não chama o Mercado Pago", async () => {
  const isenta = await loja({ cobrancaIsenta: true });
  const cancelada = await loja({ status: "CANCELADA" });
  const semEmail = await loja({ loginEmail: null });

  assert.equal((await agir(isenta.slug, { acao: "iniciar" })).status, 409);
  assert.equal((await agir(cancelada.slug, { acao: "iniciar" })).status, 409);
  const r = await agir(semEmail.slug, { acao: "iniciar" });
  assert.equal(r.status, 502);
  assert.match(r.corpo.erro ?? "", /e-mail de login/);
  assert.equal(criacoes(), 0);
  for (const t of [isenta, cancelada, semEmail]) assert.equal((await atual(t.id)).assinaturaId, null);
});

test("o aviso de assinatura autorizada ativa; repetido, não faz nada de novo", async () => {
  const t = await loja();
  await agir(t.slug, { acao: "iniciar" });
  const id = (await atual(t.id)).assinaturaId!;
  mp.preapprovals.get(id)!.status = "authorized";

  assert.deepEqual(await processarNotificacao({ topico: "subscription_preapproval", dataId: id }), { processada: true, motivo: "assinatura AUTORIZADA" });
  const depois = await atual(t.id);
  assert.deepEqual({ status: depois.assinaturaStatus, link: depois.assinaturaInitPoint }, { status: "AUTORIZADA", link: null });
  assert.deepEqual(await processarNotificacao({ topico: "subscription_preapproval", dataId: id }), { processada: false, motivo: "repetida" });
  // Recarregar a página é ler de novo do banco: o estado persiste.
  assert.equal((await atual(t.id)).assinaturaStatus, "AUTORIZADA");
});

test("alterar o valor, pausar e retomar chegam ao Mercado Pago e persistem aqui", async () => {
  const t = await loja();
  await agir(t.slug, { acao: "iniciar" });
  const id = (await atual(t.id)).assinaturaId!;
  mp.preapprovals.get(id)!.status = "authorized";
  await processarNotificacao({ topico: "subscription_preapproval", dataId: id });

  assert.equal((await agir(t.slug, { acao: "valor", centavos: 39900 })).status, 200);
  assert.equal(mp.preapprovals.get(id)!.auto_recurring.transaction_amount, 399);
  assert.equal((await agir(t.slug, { acao: "valor", centavos: 50 })).status, 422);

  assert.equal((await agir(t.slug, { acao: "pausar" })).corpo.assinaturaStatus, "PAUSADA");
  assert.equal(mp.preapprovals.get(id)!.status, "paused");
  // Pausar não derruba a loja sozinho.
  assert.equal((await atual(t.id)).status, "ATIVA");
  assert.equal((await agir(t.slug, { acao: "retomar" })).corpo.assinaturaStatus, "AUTORIZADA");
  assert.equal(mp.preapprovals.get(id)!.status, "authorized");
  assert.equal(criacoes(), 1);
});

test("Mercado Pago fora do ar: a ação devolve erro e o estado daqui não muda", async () => {
  const t = await loja();
  await agir(t.slug, { acao: "iniciar" });
  const id = (await atual(t.id)).assinaturaId!;
  mp.preapprovals.get(id)!.status = "authorized";
  await processarNotificacao({ topico: "subscription_preapproval", dataId: id });

  mp.falharAlteracao = true;
  const pausa = await agir(t.slug, { acao: "pausar" });
  assert.equal(pausa.status, 502);
  assert.equal((await atual(t.id)).assinaturaStatus, "AUTORIZADA");

  // Cancelar sem o Mercado Pago confirmar deixaria a loja "cancelada" aqui e o cartão sendo cobrado lá.
  mp.falharAlteracao = true;
  const cancelamento = await agir(t.slug, { acao: "cancelar" });
  assert.equal(cancelamento.status, 502);
  assert.equal((await atual(t.id)).assinaturaStatus, "AUTORIZADA");
  assert.equal(mp.preapprovals.get(id)!.status, "authorized");
});

test("cancelar: confirma no Mercado Pago antes de marcar aqui; já cancelada lá também fecha aqui", async () => {
  const t = await loja();
  await agir(t.slug, { acao: "iniciar" });
  const id = (await atual(t.id)).assinaturaId!;
  assert.equal((await agir(t.slug, { acao: "cancelar" })).corpo.assinaturaStatus, "CANCELADA");
  assert.equal(mp.preapprovals.get(id)!.status, "cancelled");
  assert.equal((await atual(t.id)).assinaturaInitPoint, null);

  const outra = await loja();
  await agir(outra.slug, { acao: "iniciar" });
  const idOutra = (await atual(outra.id)).assinaturaId!;
  mp.preapprovals.get(idOutra)!.status = "cancelled"; // alguém cancelou direto no painel do Mercado Pago
  mp.falharAlteracao = true; // e o Mercado Pago recusa cancelar o que já está cancelado
  assert.equal((await agir(outra.slug, { acao: "cancelar" })).status, 200);
  assert.equal((await atual(outra.id)).assinaturaStatus, "CANCELADA");
});

test("pagamento: só o aviso do Mercado Pago marca como pago, e o mesmo aviso duas vezes não duplica fatura nem evento", async () => {
  const t = await loja();
  await agir(t.slug, { acao: "iniciar" });
  const id = (await atual(t.id)).assinaturaId!;
  assert.equal((await atual(t.id)).ultimoPagamentoEm, null);

  const pagamento = String(Math.floor(Math.random() * 1e12));
  mp.pagamentos.set(pagamento, { id: Number(pagamento), preapproval_id: id, status: "processed", transaction_amount: 497, payment: { status: "approved" } });
  assert.deepEqual(await processarNotificacao({ topico: "subscription_authorized_payment", dataId: pagamento }), { processada: true, motivo: "mensalidade paga" });
  assert.deepEqual(await processarNotificacao({ topico: "subscription_authorized_payment", dataId: pagamento }), { processada: false, motivo: "repetida" });

  const faturas = await prisma.fatura.findMany({ where: { tenantId: t.id } });
  assert.deepEqual(faturas.map((f) => [f.centavos, f.status, Boolean(f.pagaEm)]), [[49700, "approved", true]]);
  assert.ok((await atual(t.id)).ultimoPagamentoEm);
  assert.equal(await prisma.automacaoEvento.count({ where: { slug: t.slug, tipo: "loja.mensalidade-paga" } }), 1);
});

test("aviso que falha fica registrado com o erro, e a nova entrega é processada", async () => {
  const t = await loja();
  await agir(t.slug, { acao: "iniciar" });
  const id = (await atual(t.id)).assinaturaId!;
  const pagamento = String(Math.floor(Math.random() * 1e12));

  // O Mercado Pago avisa de um pagamento que a API ainda não devolve.
  await assert.rejects(processarNotificacao({ topico: "subscription_authorized_payment", dataId: pagamento }));
  const falho = await prisma.cobrancaEvento.findUniqueOrThrow({ where: { notificacaoId: `subscription_authorized_payment:${pagamento}` } });
  assert.deepEqual({ processado: falho.processadoEm, temErro: Boolean(falho.erro) }, { processado: null, temErro: true });

  mp.pagamentos.set(pagamento, { id: Number(pagamento), preapproval_id: id, status: "processed", transaction_amount: 497, payment: { status: "approved" } });
  assert.deepEqual(await processarNotificacao({ topico: "subscription_authorized_payment", dataId: pagamento }), { processada: true, motivo: "mensalidade paga" });
  assert.equal(await prisma.fatura.count({ where: { tenantId: t.id } }), 1);
});

test("isenção: tirar não cria assinatura, não muda o status da loja e não avisa o lojista", async () => {
  // Teste dentro do prazo: sem a isenção a régua não reprova esta loja hoje.
  const t = await loja({ cobrancaIsenta: true, testeAte: new Date(Date.now() + 10 * 86_400_000) });
  assert.deepEqual({ ...(await isencao(t.slug)).corpo }, { isenta: true, plano: "LOJA_PRO", statusDaLoja: "ATIVA", assinaturaStatus: "SEM_ASSINATURA", temAssinatura: false, suspensaoAutomatica: false, seNaoFosseIsenta: null });

  const r = await isencao(t.slug, { isenta: false });
  assert.deepEqual([r.status, r.corpo.mudou, r.corpo.depois?.isenta], [200, true, false]);
  const depois = await atual(t.id);
  assert.deepEqual({ isenta: depois.cobrancaIsenta, assinatura: depois.assinaturaId, status: depois.status, pago: depois.ultimoPagamentoEm }, { isenta: false, assinatura: null, status: "ATIVA", pago: null });
  assert.equal(mp.chamadas.length, 0);
  assert.equal(await prisma.fatura.count({ where: { tenantId: t.id } }), 0);
  assert.equal(await prisma.automacaoEvento.count({ where: { slug: t.slug } }), 0);

  // Pedir o que já é não é mudança.
  assert.equal((await isencao(t.slug, { isenta: false })).corpo.mudou, false);
  assert.equal((await isencao(t.slug, { isenta: true })).corpo.depois?.isenta, true);
});

test("isenção: tirar de quem cairia na régua exige ciência explícita, e sem ela nada muda", async () => {
  // Teste encerrado há tempo, sem assinatura: só a isenção a mantém fora da régua.
  const t = await loja({ cobrancaIsenta: true, testeAte: new Date(Date.now() - 60 * 86_400_000) });
  assert.equal((await isencao(t.slug)).corpo.seNaoFosseIsenta, "período de teste encerrado sem assinatura");

  const semCiencia = await isencao(t.slug, { isenta: false });
  assert.deepEqual([semCiencia.status, semCiencia.corpo.precisaDeCiencia], [409, true]);
  assert.match(semCiencia.corpo.erro ?? "", /período de teste encerrado sem assinatura/);
  assert.equal((await atual(t.id)).cobrancaIsenta, true);

  const ciente = await isencao(t.slug, { isenta: false, cienteDaRegua: true });
  assert.deepEqual([ciente.status, ciente.corpo.mudou], [200, true]);
  // Mesmo assim: sem assinatura criada e sem suspensão (a automática está desligada).
  const depois = await atual(t.id);
  assert.deepEqual({ isenta: depois.cobrancaIsenta, assinatura: depois.assinaturaId, status: depois.status }, { isenta: false, assinatura: null, status: "ATIVA" });
  assert.equal(mp.chamadas.length, 0);
});

test("isenção exige o token de administração e valida a entrada", async () => {
  const t = await loja();
  const semToken = await lerIsencao(new Request("https://x/"), { params: Promise.resolve({ slug: t.slug }) });
  assert.equal(semToken.status, 401);
  assert.equal((await isencao(t.slug, { isenta: "sim" })).status, 422);
  assert.equal((await isencao(t.slug, { isenta: true, outro: 1 })).status, 422);
  assert.equal((await isencao("loja-que-nao-existe", { isenta: true })).status, 404);
});
