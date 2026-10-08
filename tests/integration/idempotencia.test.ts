import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { verificarCarrinhosAbandonados } from "../../src/lib/carrinhos";
import { salvarProdutoNoCatalogo } from "../../src/lib/catalogo-escrita";
import { resolverItensPadronizados } from "../../src/lib/catalogo-resolver";
import { liberarReservas, reservarEstoque } from "../../src/lib/catalogo-reservas";
import { avisarQuemEsperava } from "../../src/lib/estoque-avisos";
import { emitir, eventIdDaChave } from "../../src/lib/eventos";
import { atualizarStatusPagamento } from "../../src/lib/pedidos";

/**
 * O mesmo fato chegando duas vezes ao mesmo tempo. É o caso que leitura antes
 * de escrita não segura, e que só o banco prova: duas notificações do Mercado
 * Pago no mesmo instante, a rotina e o n8n chamando a mesma verificação.
 *
 * O que se conta é evento, porque evento é mensagem: cada `AutomacaoEvento` a
 * mais é um e-mail ou um WhatsApp a mais para o comprador ou para o lojista.
 */

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
// Sem n8n e sem SMTP: emitir só registra. Nada sai deste teste para fora.
delete process.env.N8N_WEBHOOK_URL;
after(() => prisma.$disconnect());

const chave = () => randomUUID().replace(/-/g, "");
const loja = () => prisma.tenant.create({ data: { slug: `qa-${chave()}`, nome: "QA Idempotência", status: "ATIVA" } });
const eventos = (slug: string, tipo: string) => prisma.automacaoEvento.count({ where: { slug, tipo } });
const produto = (tenantId: string, estoque = 5) =>
  salvarProdutoNoCatalogo(tenantId, null, {
    nome: "Limpador QA 500ml", slug: `produto-${chave()}`, precoCentavos: 4990, sku: `QA-${chave()}`, estoque,
    imagens: ["https://example.com/frasco.webp"], descricao: "Limpador para a prova de idempotência.",
  });

/** Um pedido aguardando pagamento, com a reserva de estoque que o checkout faria. */
async function pedidoAguardando(tenantId: string, produtoId: string) {
  const referencia = chave();
  const pagamentoId = `pg-${chave()}`;
  const itens = await resolverItensPadronizados(tenantId, [{ id: produtoId, quantidade: 1 }]);
  await reservarEstoque(tenantId, referencia, itens);
  const pedido = await prisma.pedido.create({
    data: {
      tenantId, referencia, pagamentoId, clienteNome: "QA", clienteEmail: "qa@example.test", clienteTelefone: "5511999999999",
      clienteDocumento: "00000000000", freteNome: "Retirada", freteCentavos: 0, subtotalCentavos: 4990, totalCentavos: 4990,
      meioPagamento: "pix", status: "AGUARDANDO_PAGAMENTO",
      itens: { create: { produtoId, varianteId: itens[0].id.split(":")[1], nome: itens[0].nome, sku: itens[0].sku, quantidade: 1, precoUnitarioCentavos: 4990 } },
    },
  });
  return { pedido, pagamentoId };
}

test("o mesmo fato emitido cinco vezes ao mesmo tempo vira um evento só", async () => {
  const t = await loja();
  const evento = { tipo: "loja.reativada" as const, slug: t.slug, nome: t.nome, url: "https://qa.example", emailContato: null, whatsapp: null };

  const saidas = await Promise.all(Array.from({ length: 5 }, () => emitir(evento, { chave: "fato-unico" })));
  assert.equal(saidas.filter(Boolean).length, 1);
  assert.equal(await eventos(t.slug, "loja.reativada"), 1);
  assert.ok(await prisma.automacaoEvento.findUnique({ where: { eventId: eventIdDaChave("loja.reativada", t.slug, "fato-unico") } }));

  // Outro fato do mesmo tipo é outro evento; e sem chave, cada emissão é uma.
  assert.equal(await emitir(evento, { chave: "outro-fato" }), true);
  assert.equal(await emitir(evento), true);
  assert.equal(await emitir(evento), true);
  assert.equal(await eventos(t.slug, "loja.reativada"), 4);
});

test("a mesma chave em lojas diferentes não se confunde", async () => {
  const [a, b] = [await loja(), await loja()];
  const de = (slug: string) => ({ tipo: "loja.reativada" as const, slug, nome: "QA", url: "https://qa.example", emailContato: null, whatsapp: null });
  assert.equal(await emitir(de(a.slug), { chave: "mesma" }), true);
  assert.equal(await emitir(de(b.slug), { chave: "mesma" }), true);
});

test("pagamento aprovado notificado duas vezes ao mesmo tempo: uma baixa de estoque e um aviso", async () => {
  const t = await loja();
  const p = await produto(t.id, 5);
  const { pedido, pagamentoId } = await pedidoAguardando(t.id, p.id);

  await Promise.all([
    atualizarStatusPagamento(t, pagamentoId, "aprovado", 4990),
    atualizarStatusPagamento(t, pagamentoId, "aprovado", 4990),
  ]);
  await atualizarStatusPagamento(t, pagamentoId, "aprovado", 4990);

  assert.equal(await eventos(t.slug, "pedido.pago"), 1);
  assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id: p.id } })).estoque, 4);
  assert.equal(await prisma.movimentoEstoque.count({ where: { tenantId: t.id, motivo: "pedido_pago" } }), 1);
  assert.equal((await prisma.pedido.findUniqueOrThrow({ where: { id: pedido.id } })).status, "PAGO");
});

test("recusa notificada duas vezes ao mesmo tempo avisa o comprador uma vez", async () => {
  const t = await loja();
  const p = await produto(t.id, 5);
  const { pedido, pagamentoId } = await pedidoAguardando(t.id, p.id);

  await Promise.all([atualizarStatusPagamento(t, pagamentoId, "recusado"), atualizarStatusPagamento(t, pagamentoId, "recusado")]);

  assert.equal(await eventos(t.slug, "pedido.recusado"), 1);
  assert.equal((await prisma.pedido.findUniqueOrThrow({ where: { id: pedido.id } })).status, "CANCELADO");
  // A reserva voltou: a unidade está à venda de novo.
  assert.equal((await resolverItensPadronizados(t.id, [{ id: p.id, quantidade: 5 }])).length, 1);
});

test("valor divergente não confirma o pedido e abre um alerta só, por mais que o gateway reenvie", async () => {
  const t = await loja();
  const p = await produto(t.id, 5);
  const { pedido, pagamentoId } = await pedidoAguardando(t.id, p.id);

  for (let i = 0; i < 3; i++) await atualizarStatusPagamento(t, pagamentoId, "aprovado", 100);

  assert.equal((await prisma.pedido.findUniqueOrThrow({ where: { id: pedido.id } })).status, "AGUARDANDO_PAGAMENTO");
  assert.equal(await eventos(t.slug, "pedido.pago"), 0);
  const alertas = await prisma.automacaoEvento.findMany({ where: { slug: t.slug, tipo: "operacao.alerta" } });
  assert.equal(alertas.length, 1);
  const corpo = alertas[0].payload as Record<string, unknown>;
  assert.equal(corpo.codigo, "pagamento.divergencia");
  assert.equal(corpo.recurso, pedido.referencia);
  assert.equal(corpo.lojaNome, t.nome);
  assert.ok(String(corpo.oQueFazer).length > 20 && String(corpo.oQueQuebrou).length > 20);
  assert.match(String(corpo.detalhe), /4990.*100/);
});

test("pagamento aprovado depois de a reserva ser liberada vira alerta, não só log", async () => {
  const t = await loja();
  const p = await produto(t.id, 5);
  const { pedido, pagamentoId } = await pedidoAguardando(t.id, p.id);
  await liberarReservas(t.id, pedido.referencia);

  await assert.rejects(atualizarStatusPagamento(t, pagamentoId, "aprovado", 4990));
  await assert.rejects(atualizarStatusPagamento(t, pagamentoId, "aprovado", 4990));

  const alertas = await prisma.automacaoEvento.findMany({ where: { slug: t.slug, tipo: "operacao.alerta" } });
  assert.equal(alertas.length, 1);
  assert.equal((alertas[0].payload as Record<string, unknown>).codigo, "pagamento.sem-estoque");
  assert.equal(await eventos(t.slug, "pedido.pago"), 0);
});

test("carrinho abandonado conferido por duas passadas ao mesmo tempo lembra o comprador uma vez", async () => {
  const t = await loja();
  const referencia = chave();
  await prisma.checkoutAberto.create({
    data: {
      tenantId: t.id, referencia, clienteNome: "QA", clienteEmail: "qa@example.test", clienteTelefone: "5511999999999",
      itens: [{ id: "x", nome: "Limpador", quantidade: 1, precoUnitario: 4990 }], totalCentavos: 4990,
      criadoEm: new Date(Date.now() - 3 * 3_600_000),
    },
  });

  await Promise.all([verificarCarrinhosAbandonados(), verificarCarrinhosAbandonados(), verificarCarrinhosAbandonados()]);

  assert.equal(await eventos(t.slug, "carrinho.abandonado"), 1);
  assert.equal((await prisma.checkoutAberto.findUniqueOrThrow({ where: { referencia } })).status, "LEMBRADO");
});

test("volta ao estoque avisada por duas passadas ao mesmo tempo sai uma vez; pedir de novo avisa de novo", async () => {
  const t = await loja();
  const p = await produto(t.id, 5);
  const aviso = await prisma.avisoEstoque.create({ data: { tenantId: t.id, produtoId: p.id, email: "qa@example.test" } });

  await Promise.all([avisarQuemEsperava(), avisarQuemEsperava(), avisarQuemEsperava()]);
  assert.equal(await eventos(t.slug, "loja.voltou-ao-estoque"), 1);

  // O produto acabou, a pessoa pediu o aviso outra vez, e ele voltou.
  await prisma.avisoEstoque.update({ where: { id: aviso.id }, data: { avisadoEm: null } });
  await avisarQuemEsperava();
  assert.equal(await eventos(t.slug, "loja.voltou-ao-estoque"), 2);
});
