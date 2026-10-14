import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { crc16Pix, valorPixEmReais } from "@avilaops/checkout/server";
import { prisma } from "../../src/lib/db";
import { salvarProdutoNoCatalogo } from "../../src/lib/catalogo-escrita";
import { resolverItensPadronizados } from "../../src/lib/catalogo-resolver";
import { criarCobranca, lerCorpoDoCheckout } from "../../src/lib/checkout-cobranca";
import { definirPadrao, resolverRecebimento, salvarCredencial } from "../../src/lib/credenciais";
import { GatewayNaoConfigurado } from "../../src/lib/gateway";
import {
  confirmarPixManual,
  expirarPixManual,
  informarPixPago,
  listarPixAConferir,
  recusarPixManual,
} from "../../src/lib/pix-manual";
import { provedoresDePagamento } from "../../src/lib/provedores-pagamento";
import { provedorVisivel } from "../../src/lib/recebimento-v2";

/**
 * Pix na conta, de ponta a ponta: o BR Code nasce, o cliente avisa, a loja
 * confirma e o pedido fica pago. O que vence sem confirmação volta o estoque.
 */

process.env.LOJAS_SECRET ??= "0".repeat(64);
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
delete process.env.N8N_WEBHOOK_URL;
after(() => prisma.$disconnect());

const sufixo = () => randomUUID().replace(/-/g, "");
const ENDERECO = { logradouro: "Rua QA", numero: "10", bairro: "Centro", cidade: "Ribeirão Preto", uf: "SP", cep: "14010000" };
const CHAVE = "123e4567-e12b-12d1-a456-426655440000";
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16)]);

/** 23 letras e números: cabe no txid do QR estático, então o txid é a referência. */
function referencia() {
  return `PIX${sufixo().slice(0, 20)}`.toUpperCase();
}

async function loja(comPix: boolean) {
  const t = await prisma.tenant.create({
    data: {
      slug: `qa-pix-${sufixo()}`,
      nome: "QA Pix",
      status: "ATIVA",
      plano: "LOJA",
      retiradaNaLoja: true,
      enderecoPublico: true,
      endereco: ENDERECO,
      ...(comPix ? { recursos: ["pagamentos_pix_manual", "recebimento_v2"] } : {}),
    },
  });
  if (!comPix) return t;
  const def = provedoresDePagamento.obter("pix_manual");
  const publicos = { chavePix: CHAVE, nomeRecebedor: "Loja QA" };
  const teste = await def.testarConexao({ segredos: {}, publicos });
  if (!teste.ok) throw new Error(teste.mensagem);
  const c = await salvarCredencial(t, "pix_manual", { segredos: {}, publicos }, teste);
  await definirPadrao(t, c.id);
  return prisma.tenant.findUniqueOrThrow({ where: { id: t.id } });
}

const produto = (tenantId: string, estoque = 2) =>
  salvarProdutoNoCatalogo(tenantId, null, {
    nome: "Limpador QA 500ml",
    slug: `produto-${sufixo()}`,
    precoCentavos: 4990,
    sku: `QA-${sufixo()}`,
    estoque,
    imagens: ["https://example.com/frasco.webp"],
    descricao: "Limpador para a prova do Pix.",
  });

function corpo(produtoId: string, ref = referencia()) {
  return {
    referencia: ref,
    itens: [{ id: produtoId, quantidade: 1 }],
    cliente: { nome: "Maria", sobrenome: "Silva", email: "maria@example.test", telefone: "11999999999", documento: "52998224725" },
    entrega: null,
    freteId: "retirada-na-loja",
    meioPagamento: "pix",
  };
}

async function cobrar(t: Awaited<ReturnType<typeof loja>>, bruto: ReturnType<typeof corpo>) {
  const lido = lerCorpoDoCheckout(bruto);
  if ("tipo" in lido) return lido;
  const recebimento = await resolverRecebimento(t);
  return criarCobranca(t, lido.corpo, { provider: recebimento.provider, credencial: recebimento.credencial });
}

const disponivel = async (tenantId: string, produtoId: string, quantidade: number) =>
  (await resolverItensPadronizados(tenantId, [{ id: produtoId, quantidade }])).length === 1;

test("cria o pedido, o cliente avisa, a loja confirma e o pedido fica pago", async () => {
  const t = await loja(true);
  const p = await produto(t.id, 2);
  const a = corpo(p.id);
  const b = corpo(p.id);

  const ra = await cobrar(t, a);
  const rb = await cobrar(t, b);
  assert.equal(ra.tipo, "ok", JSON.stringify(ra));
  assert.equal(rb.tipo, "ok", JSON.stringify(rb));
  if (ra.tipo !== "ok" || rb.tipo !== "ok") return;

  assert.equal(ra.pagamento.status, "aguardando_confirmacao");
  assert.equal(rb.pagamento.status, "aguardando_confirmacao");
  assert.equal(ra.pagamento.valor, 4990);
  assert.equal(rb.pagamento.valor, 4991);

  const copia = ra.pagamento.pix?.copiaECola ?? "";
  assert.match(copia, new RegExp(a.referencia));
  assert.match(copia, new RegExp(valorPixEmReais(4990).replace(".", "\\.")));
  assert.equal(copia.slice(-4), crc16Pix(copia.slice(0, -4)));
  assert.equal(copia.includes("maria@example.test"), false);
  assert.equal(copia.includes("52998224725"), false);
  assert.equal(copia.includes("Maria"), false);
  assert.equal(copia.includes("11999999999"), false);

  const png = Buffer.from(ra.pagamento.pix?.qrCodeBase64 ?? "", "base64");
  assert.equal(png.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), true);

  const pedidoA = await prisma.pedido.findUniqueOrThrow({ where: { referencia: a.referencia } });
  assert.equal(pedidoA.status, "AGUARDANDO_PAGAMENTO");
  assert.equal(pedidoA.pagamentoStatus, "aguardando_confirmacao");
  assert.equal(pedidoA.gateway, "pix_manual");
  assert.equal(pedidoA.totalCentavos, 4990);
  assert.equal(await disponivel(t.id, p.id, 1), false);

  const aviso = await informarPixPago(t, a.referencia, { bytes: PNG, tipo: "image/png" });
  assert.equal(aviso.ok, true, JSON.stringify(aviso));

  const fila = await listarPixAConferir(t.id);
  assert.equal(fila.length, 1);
  assert.equal(fila[0].referencia, a.referencia);
  assert.equal(fila[0].valorCentavos, 4990);
  assert.equal(fila[0].temComprovante, true);
  const textoFila = JSON.stringify(fila);
  assert.equal(textoFila.includes("maria@example.test"), false);
  assert.equal(textoFila.includes("52998224725"), false);
  assert.equal(textoFila.includes("Maria"), false);

  const confirmado = await confirmarPixManual(t, a.referencia);
  assert.equal(confirmado.ok, true, JSON.stringify(confirmado));

  const pago = await prisma.pedido.findUniqueOrThrow({ where: { referencia: a.referencia } });
  assert.equal(pago.status, "PAGO");
  assert.equal(pago.pagamentoStatus, "aprovado");
  assert.equal(pago.estoqueBaixado, true);
  assert.equal(await prisma.automacaoEvento.count({ where: { slug: t.slug, tipo: "pedido.pago" } }), 1);
  assert.equal((await listarPixAConferir(t.id)).length, 0);

  const esperando = await prisma.pedido.findUniqueOrThrow({ where: { referencia: b.referencia } });
  assert.equal(esperando.status, "AGUARDANDO_PAGAMENTO");
});

test("Pix vencido cancela o pedido e devolve o estoque", async () => {
  const t = await loja(true);
  const p = await produto(t.id, 1);
  const c = corpo(p.id);

  const r = await cobrar(t, c);
  assert.equal(r.tipo, "ok", JSON.stringify(r));
  assert.equal(await disponivel(t.id, p.id, 1), false);

  await prisma.cobrancaPixManual.update({ where: { referencia: c.referencia }, data: { expiraEm: new Date(Date.now() - 60_000) } });
  const { expirados } = await expirarPixManual();
  assert.equal(expirados >= 1, true);

  const pedido = await prisma.pedido.findUniqueOrThrow({ where: { referencia: c.referencia } });
  assert.equal(pedido.status, "CANCELADO");
  assert.equal(pedido.pagamentoStatus, "cancelado");
  assert.equal(pedido.estoqueBaixado, false);
  assert.equal(await disponivel(t.id, p.id, 1), true);
});

test("Não recebido cancela o pedido e devolve o estoque", async () => {
  const t = await loja(true);
  const p = await produto(t.id, 1);
  const c = corpo(p.id);

  const r = await cobrar(t, c);
  assert.equal(r.tipo, "ok", JSON.stringify(r));
  const aviso = await informarPixPago(t, c.referencia);
  assert.equal(aviso.ok, true, JSON.stringify(aviso));

  const recusa = await recusarPixManual(t, c.referencia);
  assert.equal(recusa.ok, true, JSON.stringify(recusa));

  const pedido = await prisma.pedido.findUniqueOrThrow({ where: { referencia: c.referencia } });
  assert.equal(pedido.status, "CANCELADO");
  assert.equal(pedido.pagamentoStatus, "recusado");
  assert.equal(await disponivel(t.id, p.id, 1), true);
  assert.equal((await listarPixAConferir(t.id)).length, 0);
});

test("loja sem a flag não vê o Pix na conta e não gera cobrança", async () => {
  const t = await loja(false);
  assert.equal(provedorVisivel(t, "pix_manual"), null);
  await assert.rejects(resolverRecebimento(t), GatewayNaoConfigurado);
  assert.equal(await prisma.cobrancaPixManual.count({ where: { tenantId: t.id } }), 0);
});
