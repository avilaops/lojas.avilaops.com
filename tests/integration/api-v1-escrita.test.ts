import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { escoposDaChave, gerarChave } from "../../src/lib/api-chaves";
import { salvarProdutoNoCatalogo } from "../../src/lib/catalogo-escrita";
import { POST as postProdutos } from "../../src/app/api/v1/produtos/route";
import { PATCH as patchProduto } from "../../src/app/api/v1/produtos/[id]/route";
import { GET as getPedido, PATCH as patchPedido } from "../../src/app/api/v1/pedidos/[id]/route";

/**
 * A escrita da API para desenvolvedores contra o Postgres: criar e editar
 * produto, avançar pedido. O que importa provar é o que um ERP faz de errado
 * sem querer: mandar duas vezes, mandar campo que não existe, mexer na loja
 * do vizinho.
 */

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
delete process.env.N8N_WEBHOOK_URL;
after(() => prisma.$disconnect());

const sufixo = () => randomUUID().replace(/-/g, "");
const loja = () => prisma.tenant.create({ data: { slug: `qa-esc-${sufixo()}`, nome: "QA Escrita", status: "ATIVA", plano: "LOJA_PRO" } });

async function chave(tenantId: string, escopos: string[]) {
  const g = gerarChave("SECRETA");
  await prisma.chaveApi.create({ data: { tenantId, tipo: "SECRETA", nome: "QA", escopos: escoposDaChave("SECRETA", escopos), hash: g.hash, prefixo: g.prefixo, final: g.final } });
  return g.chave;
}

type Rota<P> = (r: Request, s: { params: Promise<P> }) => Promise<Response>;
async function mandar<P>(rota: Rota<P>, metodo: string, caminho: string, chaveApi: string, corpo?: unknown, params?: P) {
  const r = await rota(
    new Request(`https://lojas.avilaops.com${caminho}`, {
      method: metodo,
      headers: { authorization: `Bearer ${chaveApi}`, "content-type": "application/json" },
      ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
    }),
    { params: Promise.resolve((params ?? {}) as P) },
  );
  return { status: r.status, corpo: (await r.json()) as { dados?: Record<string, unknown>; erro?: { codigo: string; mensagem: string } } };
}

async function pedidoPago(tenantId: string, status: "PAGO" | "AGUARDANDO_PAGAMENTO" = "PAGO") {
  return prisma.pedido.create({
    data: {
      tenantId, referencia: sufixo(), clienteNome: "QA", clienteEmail: "qa@example.test", clienteTelefone: "5511999999999",
      clienteDocumento: "00000000000", freteNome: "Transportadora QA", freteCentavos: 0, subtotalCentavos: 4990, totalCentavos: 4990,
      meioPagamento: "pix", status,
    },
  });
}

const eventos = (slug: string, tipo: string) => prisma.automacaoEvento.count({ where: { slug, tipo } });

test("criar produto: nasce inativo, com variante e preço, e aparece no histórico como vindo da API", async () => {
  const t = await loja();
  const k = await chave(t.id, ["catalogo:ler", "produtos:escrever"]);
  const sku = `ERP-${sufixo().slice(0, 8)}`;

  const r = await mandar(postProdutos, "POST", "/api/v1/produtos", k, { nome: "Retentor Açaí 25x52", sku, precoCentavos: 4990, estoque: 7, marca: "Sabó" });
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  const d = r.corpo.dados!;
  assert.equal(d.slug, "retentor-acai-25x52");
  assert.equal(d.ativo, false);
  assert.equal(d.precoCentavos, 4990);
  assert.equal(d.estoque, 7);
  assert.equal(d.sku, sku);

  const gravado = await prisma.produto.findUniqueOrThrow({ where: { id: String(d.id) }, include: { variantes: true } });
  assert.equal(gravado.variantes.length, 1);
  assert.match(gravado.busca, /retentor acai/);
  const historico = await prisma.historicoCatalogo.findFirst({ where: { produtoId: gravado.id } });
  assert.match(String(historico?.origem), /^api:/);
});

test("criar de novo o mesmo produto responde conflito e não duplica", async () => {
  const t = await loja();
  const k = await chave(t.id, ["produtos:escrever"]);
  const corpo = { nome: "Rolamento 6203", sku: `ERP-${sufixo().slice(0, 8)}`, precoCentavos: 1990 };

  assert.equal((await mandar(postProdutos, "POST", "/api/v1/produtos", k, corpo)).status, 200);
  const de_novo = await mandar(postProdutos, "POST", "/api/v1/produtos", k, corpo);
  assert.equal(de_novo.status, 409, JSON.stringify(de_novo.corpo));
  assert.equal(de_novo.corpo.erro?.codigo, "conflito");
  // Mesmo SKU com outro nome: também é o mesmo produto para o ERP.
  const outro_nome = await mandar(postProdutos, "POST", "/api/v1/produtos", k, { ...corpo, nome: "Rolamento 6203 ZZ" });
  assert.equal(outro_nome.status, 409, JSON.stringify(outro_nome.corpo));
  assert.equal(await prisma.produto.count({ where: { tenantId: t.id } }), 1);
});

test("criar recusa campo desconhecido, preço em reais e categoria que não existe", async () => {
  const t = await loja();
  const k = await chave(t.id, ["produtos:escrever"]);
  const base = { nome: "Produto QA", precoCentavos: 1000 };

  for (const corpo of [
    { ...base, preco: 49.9 },
    { ...base, precoCentavos: 49.9 },
    { nome: "Sem preço" },
    { ...base, imagens: ["https://exemplo.com/foto.jpg"] },
    { ...base, categoria: "categoria-que-nao-existe" },
    { ...base, gtin: "abc" },
  ]) {
    const r = await mandar(postProdutos, "POST", "/api/v1/produtos", k, corpo);
    assert.equal(r.status, 400, JSON.stringify(corpo));
    assert.equal(r.corpo.erro?.codigo, "parametro_invalido");
  }
  assert.equal(await prisma.produto.count({ where: { tenantId: t.id } }), 0);
});

test("editar muda o cadastro e não toca em preço nem estoque", async () => {
  const t = await loja();
  const k = await chave(t.id, ["produtos:escrever"]);
  const categoria = await prisma.categoria.create({ data: { tenantId: t.id, slug: "retentores", nome: "Retentores" } });
  const p = await salvarProdutoNoCatalogo(t.id, null, { nome: "Retentor", slug: `retentor-${sufixo()}`, precoCentavos: 4990, estoque: 5, sku: `QA-${sufixo()}` });

  const r = await mandar(patchProduto, "PATCH", `/api/v1/produtos/${p.id}`, k, { nome: "Retentor 25x52x15", marca: "Sabó", categoria: "retentores", ativo: false }, { id: p.id });
  assert.equal(r.status, 200, JSON.stringify(r.corpo));
  assert.equal(r.corpo.dados!.nome, "Retentor 25x52x15");
  assert.equal(r.corpo.dados!.ativo, false);
  assert.deepEqual(r.corpo.dados!.categoria, { id: categoria.id, slug: "retentores", nome: "Retentores" });
  assert.equal(r.corpo.dados!.precoCentavos, 4990);
  assert.equal(r.corpo.dados!.estoque, 5);

  // Pelo slug também, e a mesma edição de novo não muda nada.
  const de_novo = await mandar(patchProduto, "PATCH", `/api/v1/produtos/${p.slug}`, k, { nome: "Retentor 25x52x15" }, { id: p.slug });
  assert.equal(de_novo.status, 200);

  // Preço e estoque não são deste caminho.
  for (const corpo of [{ precoCentavos: 1 }, { estoque: 0 }, {}]) {
    const recusa = await mandar(patchProduto, "PATCH", `/api/v1/produtos/${p.id}`, k, corpo, { id: p.id });
    assert.equal(recusa.status, 400, JSON.stringify(corpo));
  }
  assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id: p.id } })).precoCentavos, 4990);
});

test("produto e pedido de outra loja não existem para a chave", async () => {
  const [a, b] = [await loja(), await loja()];
  const k = await chave(a.id, ["produtos:escrever", "pedidos:ler", "pedidos:escrever"]);
  const doVizinho = await salvarProdutoNoCatalogo(b.id, null, { nome: "Do vizinho", slug: `vizinho-${sufixo()}`, precoCentavos: 1000 });
  const pedidoDoVizinho = await pedidoPago(b.id);

  const p = await mandar(patchProduto, "PATCH", `/api/v1/produtos/${doVizinho.id}`, k, { nome: "Invadido" }, { id: doVizinho.id });
  assert.equal(p.status, 404);
  assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id: doVizinho.id } })).nome, "Do vizinho");

  for (const id of [pedidoDoVizinho.id, pedidoDoVizinho.referencia]) {
    assert.equal((await mandar(getPedido, "GET", `/api/v1/pedidos/${id}`, k, undefined, { id })).status, 404);
    assert.equal((await mandar(patchPedido, "PATCH", `/api/v1/pedidos/${id}`, k, { status: "CANCELADO" }, { id })).status, 404);
  }
  assert.equal((await prisma.pedido.findUniqueOrThrow({ where: { id: pedidoDoVizinho.id } })).status, "PAGO");
});

test("escrever exige o escopo de escrita: ler catálogo e pedidos não basta", async () => {
  const t = await loja();
  // A chave do ERP, com o escopo de preço e estoque: não cria nem edita produto.
  const doErp = await chave(t.id, ["catalogo:ler", "catalogo:escrever"]);
  const pelaChaveDoErp = await mandar(postProdutos, "POST", "/api/v1/produtos", doErp, { nome: "X", precoCentavos: 1 });
  assert.equal(pelaChaveDoErp.status, 403);
  assert.equal(pelaChaveDoErp.corpo.erro?.codigo, "escopo_insuficiente");

  const soLeitura = await chave(t.id, ["catalogo:ler", "pedidos:ler"]);
  const pedido = await pedidoPago(t.id);

  const criar = await mandar(postProdutos, "POST", "/api/v1/produtos", soLeitura, { nome: "X", precoCentavos: 1 });
  assert.equal(criar.status, 403);
  assert.equal(criar.corpo.erro?.codigo, "escopo_insuficiente");
  const avancar = await mandar(patchPedido, "PATCH", `/api/v1/pedidos/${pedido.id}`, soLeitura, { status: "ENVIADO" }, { id: pedido.id });
  assert.equal(avancar.status, 403);
  assert.equal((await mandar(getPedido, "GET", `/api/v1/pedidos/${pedido.id}`, soLeitura, undefined, { id: pedido.id })).status, 200);
});

test("avançar pedido: envia com rastreio, avisa o comprador uma vez, e reenviar não repete", async () => {
  const t = await loja();
  const k = await chave(t.id, ["pedidos:ler", "pedidos:escrever"]);
  const pedido = await pedidoPago(t.id);
  const enviar = () => mandar(patchPedido, "PATCH", `/api/v1/pedidos/${pedido.referencia}`, k, { status: "ENVIADO", rastreio: "BR123456789BR" }, { id: pedido.referencia });

  const primeira = await enviar();
  assert.equal(primeira.status, 200, JSON.stringify(primeira.corpo));
  assert.equal(primeira.corpo.dados!.status, "ENVIADO");
  assert.equal(primeira.corpo.dados!.mudou, true);
  assert.equal(JSON.stringify(primeira.corpo.dados).includes("BR123456789BR"), true);

  const [segunda, terceira] = await Promise.all([enviar(), enviar()]);
  assert.equal(segunda.status, 200);
  assert.equal(segunda.corpo.dados!.mudou, false);
  assert.equal(terceira.corpo.dados!.mudou, false);
  assert.equal(await eventos(t.slug, "pedido.enviado"), 1);

  // Só o rastreio, sem status: corrige o código sem avisar de novo.
  const corrigir = await mandar(patchPedido, "PATCH", `/api/v1/pedidos/${pedido.id}`, k, { rastreio: "BR987654321BR" }, { id: pedido.id });
  assert.equal(corrigir.status, 200);
  assert.equal((await prisma.pedido.findUniqueOrThrow({ where: { id: pedido.id } })).rastreio, "BR987654321BR");
  assert.equal(await eventos(t.slug, "pedido.enviado"), 1);
});

test("duas integrações marcando enviado ao mesmo tempo avisam o comprador uma vez", async () => {
  const t = await loja();
  const k = await chave(t.id, ["pedidos:escrever"]);
  const pedido = await pedidoPago(t.id);
  const enviar = () => mandar(patchPedido, "PATCH", `/api/v1/pedidos/${pedido.id}`, k, { status: "ENVIADO" }, { id: pedido.id });

  const respostas = await Promise.all([enviar(), enviar(), enviar()]);
  assert.ok(respostas.every((r) => r.status === 200));
  assert.equal(await eventos(t.slug, "pedido.enviado"), 1);
});

test("pedido que não foi pago só pode ser cancelado; pagamento não muda por aqui", async () => {
  const t = await loja();
  const k = await chave(t.id, ["pedidos:escrever"]);
  const pedido = await pedidoPago(t.id, "AGUARDANDO_PAGAMENTO");
  const mudar = (corpo: unknown) => mandar(patchPedido, "PATCH", `/api/v1/pedidos/${pedido.id}`, k, corpo, { id: pedido.id });

  const enviar = await mudar({ status: "ENVIADO" });
  assert.equal(enviar.status, 409, JSON.stringify(enviar.corpo));
  assert.equal(enviar.corpo.erro?.codigo, "conflito");
  for (const corpo of [{ status: "PAGO" }, { status: "ESTORNADO" }, { situacao: "ENVIADO" }, {}]) {
    assert.equal((await mudar(corpo)).status, 400, JSON.stringify(corpo));
  }
  assert.equal((await prisma.pedido.findUniqueOrThrow({ where: { id: pedido.id } })).status, "AGUARDANDO_PAGAMENTO");

  assert.equal((await mudar({ status: "CANCELADO" })).status, 200);
  assert.equal(await eventos(t.slug, "pedido.cancelado"), 1);
});
