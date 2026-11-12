import assert from "node:assert/strict";
import { after, test } from "node:test";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { salvarProdutoNoCatalogo, ajustarOfertaNoCatalogo } from "../../src/lib/catalogo-escrita";
import { reservarEstoque, liberarReservas } from "../../src/lib/catalogo-reservas";
import { resolverItensPadronizados } from "../../src/lib/catalogo-resolver";
import { movimentarEstoqueMultilocal } from "../../src/lib/estoque-multilocal";
import { gerarChave, escoposDaChave } from "../../src/lib/api-chaves";
import { POST } from "../../src/app/api/v1/estoque/movimentos/route";
import { GET as getSaldos } from "../../src/app/api/v1/estoque/saldos/route";
import { GET as getRazao } from "../../src/app/api/v1/estoque/razao/route";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige banco isolado local :5548/*_test.");
}
after(() => prisma.$disconnect());

async function fixture(estoque: number | null = 5) {
  const t = await prisma.tenant.create({ data: { slug: `avl236-${randomUUID()}`, nome: "QA Estoque", status: "ATIVA", plano: "LOJA_PRO" } });
  const p = await salvarProdutoNoCatalogo(t.id, null, { nome: "Peça QA", slug: "peca-qa", precoCentavos: 100, estoque });
  const v = await prisma.variante.findFirstOrThrow({ where: { tenantId: t.id, produtoId: p.id } });
  return { t, p, v };
}

function comando(varianteId: string, local = "principal", tipo = "entrada", quantidade = 1) {
  return { tipo, varianteId, local, quantidade, motivo: "Conferência física QA" };
}
const mover = (tenantId: string, corpo: unknown, chave = randomUUID()) => movimentarEstoqueMultilocal(tenantId, chave, corpo, "teste:avl236");
const saldo = (tenantId: string, varianteId: string, local = "principal") => prisma.saldoEstoque.findUniqueOrThrow({ where: { tenantId_varianteId_local: { tenantId, varianteId, local } } });

test("entrada idempotente concorrente tem um recibo e uma alteração física", async () => {
  const { t, v } = await fixture();
  const chave = randomUUID();
  const corpo = comando(v.id);
  const respostas = await Promise.all([mover(t.id, corpo, chave), mover(t.id, corpo, chave)]);
  assert.deepEqual(respostas[0], respostas[1]);
  assert.equal((await saldo(t.id, v.id)).fisico, 6);
  assert.equal(await prisma.comandoEstoque.count({ where: { tenantId: t.id } }), 1);
  const linhas = await prisma.razaoEstoque.findMany({ where: { tenantId: t.id, comandoId: respostas[0].comandoId } });
  assert.equal(linhas.length, 1);
  assert.equal(linhas[0].fisicoAntes, 5);
  assert.equal(linhas[0].fisicoDepois, 6);
  assert.equal(linhas[0].origem, "teste:avl236");
  await assert.rejects(() => mover(t.id, { ...corpo, quantidade: 2 }, chave), /outro movimento/);
});

test("transferência imediata conserva total e não anuncia saldo remoto na vitrine", async () => {
  const { t, p, v } = await fixture(2);
  const r = await mover(t.id, { ...comando(v.id, "principal", "transferencia", 2), destino: "filial-02" });
  assert.equal((await saldo(t.id, v.id)).fisico, 0);
  assert.equal((await saldo(t.id, v.id, "filial-02")).fisico, 2);
  assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id: p.id } })).estoque, 0);
  assert.deepEqual(await resolverItensPadronizados(t.id, [{ id: p.id, quantidade: 1 }]), []);
  const linhas = await prisma.razaoEstoque.findMany({ where: { comandoId: r.comandoId }, orderBy: { sequencia: "asc" } });
  assert.equal(linhas.filter(l => l.tipo === "FISICO").length, 2);
  await mover(t.id, { ...comando(v.id, "filial-02", "transferencia", 1), destino: "principal" });
  assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id: p.id } })).estoque, 1);
});

test("entrada no principal reabre a oferta esgotada pelo ajuste de estoque", async () => {
  const { t, p, v } = await fixture(1);
  await ajustarOfertaNoCatalogo(t.id, v.id, { estoque: 0 }, "teste:erp");
  assert.equal((await prisma.variante.findUniqueOrThrow({ where: { id: v.id } })).disponibilidade, "out_of_stock");
  await mover(t.id, comando(v.id, "principal", "entrada", 3));
  const itens = await resolverItensPadronizados(t.id, [{ id: p.id, quantidade: 3 }]);
  assert.equal(itens.length, 1);
  assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id: p.id } })).disponibilidade, "in_stock");
});

test("transferência recebida no principal reabre a oferta sem prometer estoque remoto", async () => {
  const { t, p, v } = await fixture(1);
  await ajustarOfertaNoCatalogo(t.id, v.id, { estoque: 0 }, "teste:erp");
  await mover(t.id, comando(v.id, "filial", "entrada", 3));
  assert.deepEqual(await resolverItensPadronizados(t.id, [{ id: p.id, quantidade: 1 }]), []);
  await mover(t.id, { ...comando(v.id, "filial", "transferencia", 2), destino: "principal" });
  assert.equal((await resolverItensPadronizados(t.id, [{ id: p.id, quantidade: 2 }])).length, 1);
});

test("movimentação no principal preserva a escolha explícita de venda sob encomenda", async () => {
  const { t, p, v } = await fixture(2);
  await salvarProdutoNoCatalogo(t.id, p.id, { disponibilidade: "backorder" }, { versao: p.versaoCatalogo });
  await mover(t.id, comando(v.id, "principal", "saida", 2));
  assert.equal((await prisma.variante.findUniqueOrThrow({ where: { id: v.id } })).disponibilidade, "backorder");
  await mover(t.id, comando(v.id));
  assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id: p.id } })).disponibilidade, "backorder");
  assert.equal((await resolverItensPadronizados(t.id, [{ id: p.id, quantidade: 1 }])).length, 1);
});

test("falha na transferência reverte destino criado, razão, recibo e evento", async () => {
  const { t, v } = await fixture(1);
  const chave = randomUUID();
  const transferencia = { ...comando(v.id, "principal", "transferencia", 2), destino: "aaa" };
  const antes = await prisma.razaoEstoque.count({ where: { tenantId: t.id } });
  const eventos = await prisma.eventoCatalogo.count({ where: { tenantId: t.id } });
  // Destino ordena antes da origem: já recebeu a entrada quando a saída é recusada.
  await assert.rejects(() => mover(t.id, transferencia, chave), /insuficiente/);
  assert.equal(await prisma.saldoEstoque.count({ where: { tenantId: t.id } }), 1);
  assert.equal(await prisma.razaoEstoque.count({ where: { tenantId: t.id } }), antes);
  assert.equal(await prisma.comandoEstoque.count({ where: { tenantId: t.id } }), 0);
  assert.equal(await prisma.eventoCatalogo.count({ where: { tenantId: t.id } }), eventos);
  await mover(t.id, comando(v.id));
  await mover(t.id, transferencia, chave);
  assert.equal((await saldo(t.id, v.id, "aaa")).fisico, 2);
});

test("saldo remoto não controlado não transforma oferta do principal em ilimitada", async () => {
  const { t, p, v } = await fixture(1);
  await prisma.saldoEstoque.create({ data: { tenantId: t.id, varianteId: v.id, local: "remoto", fisico: null } });
  await mover(t.id, comando(v.id, "principal", "saida"));
  assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id: p.id } })).estoque, 0);
  assert.deepEqual(await resolverItensPadronizados(t.id, [{ id: p.id, quantidade: 1 }]), []);
});

test("transferências em sentidos opostos não perdem unidades nem duplicam o razão", async () => {
  const { t, v } = await fixture(5);
  await mover(t.id, comando(v.id, "filial", "entrada", 5));
  await Promise.all([
    mover(t.id, { ...comando(v.id, "principal", "transferencia", 2), destino: "filial" }),
    mover(t.id, { ...comando(v.id, "filial", "transferencia", 3), destino: "principal" }),
  ]);
  assert.equal((await saldo(t.id, v.id)).fisico, 6);
  assert.equal((await saldo(t.id, v.id, "filial")).fisico, 4);
});

test("saídas simultâneas não consomem duas vezes a última unidade", async () => {
  const { t, v } = await fixture(1);
  const r = await Promise.allSettled([mover(t.id, comando(v.id, "principal", "saida")), mover(t.id, comando(v.id, "principal", "saida"))]);
  assert.equal(r.filter(x => x.status === "fulfilled").length, 1);
  assert.equal((await saldo(t.id, v.id)).fisico, 0);
});

test("reserva concorrente com saída disputa a mesma unidade e razão registra liberação", async () => {
  const { t, p, v } = await fixture(1);
  const itens = await resolverItensPadronizados(t.id, [{ id: p.id, quantidade: 1 }]);
  const ref = randomUUID();
  const r = await Promise.allSettled([reservarEstoque(t.id, ref, itens), mover(t.id, comando(v.id, "principal", "saida"))]);
  assert.equal(r.filter(x => x.status === "fulfilled").length, 1);
  const s = await saldo(t.id, v.id);
  assert.ok(s.fisico! >= s.reservado);
  if (r[0].status === "fulfilled") {
    await assert.rejects(() => mover(t.id, comando(v.id, "principal", "saida")), /insuficiente/);
    await liberarReservas(t.id, ref);
    const linhas = await prisma.razaoEstoque.findMany({ where: { tenantId: t.id }, orderBy: { sequencia: "asc" } });
    assert.ok(linhas.some(l => l.tipo === "RESERVA" && l.reservadoDepois === 1));
    assert.ok(linhas.some(l => l.tipo === "LIBERACAO" && l.reservadoDepois === 0));
  }
});

test("reserva/liberação e ajuste legados são auditados sem alteração dos seus escritores", async () => {
  const { t, p, v } = await fixture(2);
  const itens = await resolverItensPadronizados(t.id, [{ id: p.id, quantidade: 1 }]);
  const ref = randomUUID();
  await reservarEstoque(t.id, ref, itens);
  await liberarReservas(t.id, ref);
  await ajustarOfertaNoCatalogo(t.id, v.id, { estoque: 3 }, "teste");
  const linhas = await prisma.razaoEstoque.findMany({ where: { tenantId: t.id }, orderBy: { sequencia: "asc" } });
  assert.deepEqual(linhas.map(l => l.tipo), ["ABERTURA", "RESERVA", "LIBERACAO", "FISICO"]);
  assert.equal(linhas.at(-1)?.fisicoDepois, 3);
});

test("razão e recibo recusam UPDATE, DELETE e TRUNCATE; identidade do saldo é estável", async () => {
  const { t, v } = await fixture();
  const r = await mover(t.id, comando(v.id));
  await assert.rejects(() => prisma.razaoEstoque.updateMany({ where: { tenantId: t.id }, data: { motivo: "sobrescrever" } }), /imutáveis/);
  await assert.rejects(() => prisma.razaoEstoque.deleteMany({ where: { tenantId: t.id } }), /imutáveis/);
  await assert.rejects(() => prisma.$executeRaw`TRUNCATE "RazaoEstoque"`, /imutáveis/);
  await assert.rejects(() => prisma.$executeRaw`TRUNCATE "SaldoEstoque"`, /imutáveis/);
  await assert.rejects(() => prisma.comandoEstoque.update({ where: { id: r.comandoId }, data: { resumoHash: "alterado" } }), /imutáveis/);
  await assert.rejects(() => prisma.comandoEstoque.delete({ where: { id: r.comandoId } }), /imutáveis/);
  await assert.rejects(() => prisma.saldoEstoque.updateMany({ where: { tenantId: t.id }, data: { local: "renomeado" } }), /Identidade/);
});

test("tenant alheio, estoque não controlado e estouro de Int não produzem recibo", async () => {
  const a = await fixture();
  const b = await fixture(null);
  await assert.rejects(() => mover(b.t.id, comando(a.v.id)), /não encontrada/);
  await assert.rejects(() => mover(b.t.id, comando(b.v.id)), /não controla/);
  await prisma.saldoEstoque.updateMany({ where: { tenantId: a.t.id }, data: { fisico: 2_147_483_647 } });
  await assert.rejects(() => mover(a.t.id, comando(a.v.id)), /limite/);
  assert.equal(await prisma.comandoEstoque.count({ where: { tenantId: { in: [a.t.id, b.t.id] } } }), 0);
});

async function apiChave(tenantId: string, escopos: string[], tipo: "SECRETA" | "PUBLICAVEL" = "SECRETA") {
  const k = gerarChave(tipo);
  await prisma.chaveApi.create({ data: { tenantId, tipo, nome: "QA", escopos: escoposDaChave(tipo, escopos), hash: k.hash, prefixo: k.prefixo, final: k.final } });
  return k.chave;
}

async function chamar(rota: typeof POST, chave: string, corpo?: unknown, caminho = "movimentos", idempotencia?: string) {
  return rota(new Request(`https://example.test/api/v1/estoque/${caminho}`, {
    method: corpo === undefined ? "GET" : "POST",
    headers: { authorization: `Bearer ${chave}`, "content-type": "application/json", ...(idempotencia ? { "idempotency-key": idempotencia } : {}) },
    ...(corpo === undefined ? {} : { body: JSON.stringify(corpo) }),
  }), { params: Promise.resolve({}) });
}

test("API exige escopo novo, recusa chave pública, corpo inválido e chave idempotente ausente", async () => {
  const { t, v } = await fixture();
  for (const chave of [await apiChave(t.id, ["catalogo:escrever"]), await apiChave(t.id, [], "PUBLICAVEL")]) {
    assert.equal((await chamar(POST, chave, comando(v.id), "movimentos", randomUUID())).status, 403);
  }
  const k = await apiChave(t.id, ["estoque:escrever"]);
  assert.equal((await chamar(POST, k, comando(v.id))).status, 400);
  assert.equal((await chamar(POST, k, { ...comando(v.id), tenantId: "alheio" }, "movimentos", randomUUID())).status, 400);
  const res = await chamar(POST, k, comando(v.id), "movimentos", randomUUID());
  assert.equal(res.status, 200);
  assert.ok(res.headers.has("x-requisicao-id"));
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("API isola consultas, serializa sequência, pagina e devolve conflito em replay divergente", async () => {
  const a = await fixture();
  const b = await fixture();
  const k = await apiChave(a.t.id, ["estoque:escrever", "catalogo:ler"]);
  const chave = randomUUID();
  const primeiro = await chamar(POST, k, comando(a.v.id), "movimentos", chave);
  const replay = await chamar(POST, k, comando(a.v.id), "movimentos", chave);
  assert.deepEqual(await replay.json(), await primeiro.json());
  assert.equal((await chamar(POST, k, { ...comando(a.v.id), quantidade: 2 }, "movimentos", chave)).status, 409);
  assert.equal((await chamar(POST, k, comando(b.v.id), "movimentos", randomUUID())).status, 404);
  const saldos = await chamar(getSaldos, k, undefined, `saldos?varianteId=${b.v.id}`);
  assert.deepEqual((await saldos.json()).dados, []);
  const razao = await chamar(getRazao, k, undefined, "razao?porPagina=1");
  const corpo = await razao.json();
  assert.equal(corpo.dados.length, 1);
  assert.equal(corpo.dados[0].tenantId, a.t.id);
  assert.equal(typeof corpo.dados[0].sequencia, "string");
  assert.ok(corpo.paginacao.total >= 2);
  assert.equal((await chamar(getRazao, k, undefined, "razao?porPagina=101")).status, 400);
});

test("API devolve não encontrado se o produto é excluído enquanto aguarda a trava", async () => {
  const { t, p, v } = await fixture();
  const k = await apiChave(t.id, ["estoque:escrever"]);
  let anunciarExclusao!: (pid: number) => void;
  let concluirExclusao!: () => void;
  const exclusaoIniciada = new Promise<number>(resolve => { anunciarExclusao = resolve; });
  const liberacao = new Promise<void>(resolve => { concluirExclusao = resolve; });
  const exclusao = prisma.$transaction(async tx => {
    const [{ pid }] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
    await tx.produto.delete({ where: { id: p.id } });
    anunciarExclusao(pid);
    await liberacao;
  }, { timeout: 15_000 });
  // Propaga erro de preparação para não deixar o teste aguardando sem diagnóstico.
  const pid = await Promise.race([exclusaoIniciada, exclusao.then(() => { throw new Error("Exclusão sem sinal de trava"); })]);
  const respostaPendente = chamar(POST, k, comando(v.id), "movimentos", randomUUID());
  try {
    let aguardandoProduto = false;
    for (let tentativa = 0; tentativa < 100; tentativa++) {
      const [{ bloqueado }] = await prisma.$queryRaw<Array<{ bloqueado: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity
          WHERE ${pid} = ANY(pg_blocking_pids(pid))
            AND query LIKE '%"Produto"%FOR UPDATE%'
        ) AS bloqueado`;
      if (bloqueado) { aguardandoProduto = true; break; }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    assert.ok(aguardandoProduto, "A requisição deve ter lido a variante antes do commit da exclusão");
  } finally {
    concluirExclusao();
    try {
      await exclusao;
    } finally {
      await respostaPendente;
    }
  }
  const resposta = await respostaPendente;
  assert.equal(resposta.status, 404);
  assert.equal((await resposta.json()).erro.codigo, "nao_encontrado");
  assert.equal(await prisma.comandoEstoque.count({ where: { tenantId: t.id } }), 0);
});
