import { after, test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { prisma } from "../../src/lib/db";
import { salvarGradeNoCatalogo, salvarProdutoNoCatalogo } from "../../src/lib/catalogo-escrita";
import { origemDoPainel } from "../../src/lib/catalogo-origem";
import { GET as consulta } from "../../src/app/api/admin/tenants/[slug]/produtos/consulta/route";
import { GET as ficha, PATCH as editar } from "../../src/app/api/admin/tenants/[slug]/produtos/[id]/route";

/**
 * A consulta e a edição do catálogo pelo painel da Ávila Ops, contra o
 * Postgres. O que só o banco prova: o indicador e a lista dizem o mesmo
 * número, a ordenação é a do português, o estoque vem das variações, uma loja
 * não enxerga a outra, e toda alteração deixa quem, o quê, antes e depois.
 */

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
delete process.env.N8N_WEBHOOK_URL;
process.env.LOJAS_ADMIN_TOKEN = "token-de-teste-do-admin";
after(() => prisma.$disconnect());

const sufixo = () => randomUUID().replace(/-/g, "").slice(0, 12);
const loja = () => prisma.tenant.create({ data: { slug: `qa-adm-${sufixo()}`, nome: "QA Admin", status: "ATIVA", plano: "LOJA_PRO" } });

type Campos = Parameters<typeof salvarProdutoNoCatalogo>[2];
async function produto(tenantId: string, campos: Campos) {
  const criado = await salvarProdutoNoCatalogo(tenantId, null, { slug: `p-${sufixo()}`, precoCentavos: 1000, ativo: true, ...campos }, { origem: "importacao" });
  return prisma.produto.findUniqueOrThrow({ where: { id: criado.id } });
}

type Resposta = {
  itens: Array<{ id: string; nome: string; estoque: number | null; estoqueEstado: string; variacoes: number; categoria: { slug: string } | null }>;
  total: number; pagina: number; paginas: number; de: number; ate: number;
  grupos: Array<{ chave: string; total: number }>;
  resumo: Record<string, number>;
  facetas: { categorias: Array<{ valor: string; rotulo: string; total: number }>; marcas: Array<{ valor: string; total: number }> };
};
async function consultar(slug: string, query = "", token = "token-de-teste-do-admin") {
  const r = await consulta(new Request(`https://lojas.avilaops.com/api/admin/tenants/${slug}/produtos/consulta${query ? `?${query}` : ""}`, { headers: { authorization: `Bearer ${token}` } }), { params: Promise.resolve({ slug }) });
  return { status: r.status, corpo: (await r.json()) as Resposta };
}
async function patch(slug: string, id: string, corpo: unknown) {
  const r = await editar(
    new Request(`https://lojas.avilaops.com/api/admin/tenants/${slug}/produtos/${id}`, { method: "PATCH", headers: { authorization: "Bearer token-de-teste-do-admin", "content-type": "application/json" }, body: JSON.stringify(corpo) }),
    { params: Promise.resolve({ slug, id }) },
  );
  return { status: r.status, corpo: (await r.json()) as { erro?: string; gravados?: string[]; produto?: { versaoCatalogo: number; precoCentavos: number; ativo: boolean; categoria: { slug: string } | null } } };
}
const nomes = (r: { corpo: Resposta }) => r.corpo.itens.map((i) => i.nome);

test("sem o token de administração não há resposta, e parâmetro desconhecido é erro", async () => {
  const t = await loja();
  assert.equal((await consultar(t.slug, "", "errado")).status, 401);
  assert.equal((await consultar(t.slug, "ordem=aleatoria")).status, 422);
  assert.equal((await consultar(t.slug, "por=37")).status, 422);
  assert.equal((await consultar(t.slug, "inventado=1")).status, 422);
  assert.equal((await consultar("loja-que-nao-existe")).status, 404);
});

test("uma loja não enxerga o catálogo da outra, nem pelo id do produto", async () => {
  const [a, b] = [await loja(), await loja()];
  const daA = await produto(a.id, { nome: "Alicate exclusivo" });
  await produto(b.id, { nome: "Broca exclusiva" });

  assert.deepEqual(nomes(await consultar(a.slug)), ["Alicate exclusivo"]);
  assert.deepEqual(nomes(await consultar(b.slug)), ["Broca exclusiva"]);
  assert.equal((await consultar(b.slug, "q=alicate")).corpo.total, 0);
  assert.equal((await consultar(b.slug)).corpo.resumo.total, 1);

  const pelaB = await ficha(new Request("https://x/", { headers: { authorization: "Bearer token-de-teste-do-admin" } }), { params: Promise.resolve({ slug: b.slug, id: daA.id }) });
  assert.equal(pelaB.status, 404);
  assert.equal((await patch(b.slug, daA.id, { autor: "QA", versao: daA.versaoCatalogo, ativo: false })).status, 404);
  assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id: daA.id } })).ativo, true);
});

test("busca por nome, SKU e marca, sem ligar para acento, caixa nem ordem das palavras", async () => {
  const t = await loja();
  await produto(t.id, { nome: "Cera Blend Cleaner Wax 500 ml", sku: `789-${sufixo()}`, marca: "Vonixx" });
  await produto(t.id, { nome: "Boina de Lã Ártica 133 mm", sku: "WP-503", marca: "Wolf Pads" });
  await produto(t.id, { nome: "Aplicador 100% microfibra", sku: "AP_01" });

  assert.deepEqual(nomes(await consultar(t.slug, "q=WP-503")), ["Boina de Lã Ártica 133 mm"]);
  assert.deepEqual(nomes(await consultar(t.slug, "q=artica+la")), ["Boina de Lã Ártica 133 mm"]);
  assert.deepEqual(nomes(await consultar(t.slug, "q=VONIXX+cera")), ["Cera Blend Cleaner Wax 500 ml"]);
  assert.equal((await consultar(t.slug, "q=cera+wolf")).corpo.total, 0);
  // `%` e `_` são texto: não viram curinga que acha tudo.
  assert.deepEqual(nomes(await consultar(t.slug, `q=${encodeURIComponent("100%")}`)), ["Aplicador 100% microfibra"]);
  assert.deepEqual(nomes(await consultar(t.slug, "q=AP_01")), ["Aplicador 100% microfibra"]);
  assert.equal((await consultar(t.slug, `q=${encodeURIComponent("%")}`)).corpo.total, 1);
});

test("cada indicador conta exatamente o que o filtro dele lista, e só produto ativo", async () => {
  const t = await loja();
  await produto(t.id, { nome: "Sem foto no ar", imagens: [] });
  await produto(t.id, { nome: "Sem foto, inativo", imagens: [], ativo: false });
  await produto(t.id, { nome: "Sob consulta", precoCentavos: 0, imagens: ["https://x/a.webp"] });
  await produto(t.id, { nome: "Diz que tem e não tem", estoque: 0, disponibilidade: "in_stock", imagens: ["https://x/a.webp"] });
  await produto(t.id, { nome: "Esgotado declarado", estoque: 0, disponibilidade: "out_of_stock", imagens: ["https://x/a.webp"] });
  await produto(t.id, { nome: "Foto da família", imagens: ["https://x/a.webp"], imagemOrigem: "representativa", imagemFamilia: "6200" });
  await produto(t.id, { nome: "Certinho", estoque: 4, imagens: ["https://x/a.webp"] });

  const { resumo } = (await consultar(t.slug)).corpo;
  assert.deepEqual(
    { total: resumo.total, ativos: resumo.ativos, inativos: resumo.inativos, semFoto: resumo.semFoto, sobConsulta: resumo.sobConsulta, anunciaSemSaldo: resumo.anunciaSemSaldo, fotoDeOutroItem: resumo.fotoDeOutroItem },
    { total: 7, ativos: 6, inativos: 1, semFoto: 1, sobConsulta: 1, anunciaSemSaldo: 1, fotoDeOutroItem: 1 },
  );
  for (const [pend, campo] of [["sem-foto", "semFoto"], ["sob-consulta", "sobConsulta"], ["anuncia-sem-saldo", "anunciaSemSaldo"], ["foto-de-outro", "fotoDeOutroItem"]] as const) {
    assert.equal((await consultar(t.slug, `situacao=ativos&pend=${pend}`)).corpo.total, resumo[campo], pend);
  }
  // O indicador não muda com o filtro: é do catálogo inteiro.
  assert.equal((await consultar(t.slug, "q=certinho")).corpo.resumo.total, 7);
  // Esgotado declarado não é "anuncia sem saldo": a vitrine já diz que acabou.
  assert.deepEqual(nomes(await consultar(t.slug, "pend=anuncia-sem-saldo")), ["Diz que tem e não tem"]);
  // Faixa de preço deixa de fora quem é sob consulta, mesmo com mínimo zero.
  assert.ok(!nomes(await consultar(t.slug, "min=0&max=100000")).includes("Sob consulta"));
});

test("filtros combinam: categoria + marca + situação + pendência", async () => {
  const t = await loja();
  const lavagem = await prisma.categoria.create({ data: { tenantId: t.id, slug: "lavagem", nome: "Lavagem" } });
  const protecao = await prisma.categoria.create({ data: { tenantId: t.id, slug: "protecao", nome: "Proteção" } });
  await produto(t.id, { nome: "A", marca: "Vonixx", categoriaId: lavagem.id, imagens: [] });
  await produto(t.id, { nome: "B", marca: "Vonixx", categoriaId: lavagem.id, imagens: ["https://x/a.webp"] });
  await produto(t.id, { nome: "C", marca: "Vonixx", categoriaId: lavagem.id, imagens: [], ativo: false });
  await produto(t.id, { nome: "D", marca: "Nitro", categoriaId: protecao.id, imagens: [] });
  await produto(t.id, { nome: "E" });

  assert.deepEqual(nomes(await consultar(t.slug, "categoria=lavagem&marca=Vonixx&situacao=ativos&pend=sem-foto")), ["A"]);
  assert.deepEqual(nomes(await consultar(t.slug, "categoria=lavagem&marca=Vonixx&situacao=inativos")), ["C"]);
  assert.equal((await consultar(t.slug, "categoria=protecao&marca=Vonixx")).corpo.total, 0);
  assert.deepEqual(nomes(await consultar(t.slug, `categoria=${encodeURIComponent("~sem-categoria")}`)), ["E"]);
  assert.deepEqual(nomes(await consultar(t.slug, `marca=${encodeURIComponent("~sem-marca")}`)), ["E"]);

  const { facetas } = (await consultar(t.slug)).corpo;
  assert.deepEqual(facetas.categorias.map((c) => [c.rotulo, c.total]), [["Lavagem", 3], ["Proteção", 1], ["Sem categoria", 1]]);
  assert.deepEqual(facetas.marcas.map((m) => [m.valor, m.total]), [["Nitro", 1], ["Vonixx", 3], ["~sem-marca", 1]]);
});

test("ordenação do catálogo inteiro: português com número natural, preço com 'sob consulta' no fim", async () => {
  const t = await loja();
  await produto(t.id, { nome: "Óleo", precoCentavos: 5000 });
  await produto(t.id, { nome: "Item 10", precoCentavos: 0 });
  await produto(t.id, { nome: "água", precoCentavos: 9000 });
  await produto(t.id, { nome: "Item 2", precoCentavos: 1000 });
  await produto(t.id, { nome: "Zinco", precoCentavos: 3000 });

  assert.deepEqual(nomes(await consultar(t.slug)), ["água", "Item 2", "Item 10", "Óleo", "Zinco"]);
  assert.deepEqual(nomes(await consultar(t.slug, "ordem=nome-za")), ["Zinco", "Óleo", "Item 10", "Item 2", "água"]);
  assert.deepEqual(nomes(await consultar(t.slug, "ordem=preco-asc")), ["Item 2", "Zinco", "Óleo", "água", "Item 10"]);
  assert.deepEqual(nomes(await consultar(t.slug, "ordem=preco-desc")), ["água", "Óleo", "Zinco", "Item 2", "Item 10"]);
});

test("paginação: intervalo, total, página além do fim, e nenhum produto repetido ou perdido entre páginas", async () => {
  const t = await loja();
  // Nomes iguais de propósito: sem desempate estável eles trocariam de página.
  for (let i = 0; i < 60; i++) await produto(t.id, { nome: i % 2 ? "Produto repetido" : `Produto ${String(i).padStart(2, "0")}` });

  const p1 = (await consultar(t.slug, "por=25")).corpo;
  assert.deepEqual({ de: p1.de, ate: p1.ate, total: p1.total, paginas: p1.paginas }, { de: 1, ate: 25, total: 60, paginas: 3 });
  const p3 = (await consultar(t.slug, "por=25&pagina=3")).corpo;
  assert.deepEqual({ de: p3.de, ate: p3.ate, itens: p3.itens.length }, { de: 51, ate: 60, itens: 10 });
  assert.equal((await consultar(t.slug, "por=25&pagina=99")).corpo.pagina, 3);

  const ids = new Set<string>();
  for (const pagina of [1, 2, 3]) for (const item of (await consultar(t.slug, `por=25&pagina=${pagina}`)).corpo.itens) ids.add(item.id);
  assert.equal(ids.size, 60);
  const vazio = (await consultar(t.slug, "q=nao-existe")).corpo;
  assert.deepEqual({ itens: vazio.itens, total: vazio.total, pagina: vazio.pagina, paginas: vazio.paginas, de: vazio.de, ate: vazio.ate }, { itens: [], total: 0, pagina: 1, paginas: 1, de: 0, ate: 0 });
});

test("agrupar: os grupos vêm em ordem, 'sem' por último, com o total do grupo inteiro mesmo cortado pela página", async () => {
  const t = await loja();
  const lavagem = await prisma.categoria.create({ data: { tenantId: t.id, slug: "lavagem", nome: "Lavagem" } });
  const protecao = await prisma.categoria.create({ data: { tenantId: t.id, slug: "protecao", nome: "Proteção" } });
  for (let i = 0; i < 30; i++) await produto(t.id, { nome: `Shampoo ${String(i).padStart(2, "0")}`, categoriaId: lavagem.id });
  await produto(t.id, { nome: "Cera", categoriaId: protecao.id });
  await produto(t.id, { nome: "Avulso" });

  const p1 = (await consultar(t.slug, "grupo=categoria&por=25")).corpo;
  assert.deepEqual([...p1.grupos].sort((a, b) => a.chave.localeCompare(b.chave, "pt-BR")), [
    { chave: "Lavagem", total: 30 }, { chave: "Proteção", total: 1 }, { chave: "Sem categoria", total: 1 },
  ]);
  assert.ok(p1.itens.every((i) => i.categoria?.slug === "lavagem"));
  const p2 = (await consultar(t.slug, "grupo=categoria&por=25&pagina=2")).corpo;
  assert.deepEqual(p2.itens.map((i) => i.categoria?.slug ?? null), [...Array(5).fill("lavagem"), "protecao", null]);

  const situacao = (await consultar(t.slug, "grupo=situacao")).corpo;
  assert.deepEqual(situacao.grupos, [{ chave: "Ativos", total: 32 }]);
});

test("estoque vem das variações: não controla, zerado, com saldo, reservado e desconhecido não se confundem", async () => {
  const t = await loja();
  const naoControla = await produto(t.id, { nome: "Não controla", estoque: null });
  const zerado = await produto(t.id, { nome: "Zerado", estoque: 0 });
  const comSaldo = await produto(t.id, { nome: "Com saldo", estoque: 5 });
  const reservado = await produto(t.id, { nome: "Todo reservado", estoque: 3 });
  const semSaldo = await produto(t.id, { nome: "Sem saldo cadastrado", estoque: 9 });
  const grade = await produto(t.id, { nome: "Com grade", estoque: 1 });

  // Três unidades na prateleira, as três reservadas por pedidos em aberto: não há o que vender.
  const vReservada = await prisma.variante.findFirstOrThrow({ where: { produtoId: reservado.id, padrao: true } });
  await prisma.saldoEstoque.updateMany({ where: { varianteId: vReservada.id }, data: { reservado: 3 } });
  // Sem linha de saldo a disponibilidade é desconhecida, não zero nem infinita.
  const vSemSaldo = await prisma.variante.findFirstOrThrow({ where: { produtoId: semSaldo.id, padrao: true } });
  await prisma.saldoEstoque.deleteMany({ where: { varianteId: vSemSaldo.id } });
  // Com grade, o que vale é a soma das variações: 2 + 0.
  await salvarGradeNoCatalogo(t.id, grade.id, ["Tamanho"], [
    { valores: { Tamanho: "P" }, precoCentavos: 1000, estoque: 2 },
    { valores: { Tamanho: "G" }, precoCentavos: 1000, estoque: 0 },
  ]);

  const { itens, resumo } = (await consultar(t.slug)).corpo;
  const de = (id: string) => { const i = itens.find((x) => x.id === id)!; return [i.estoqueEstado, i.estoque, i.variacoes]; };
  assert.deepEqual(de(naoControla.id), ["nao-controla", null, 0]);
  assert.deepEqual(de(zerado.id), ["controlado", 0, 0]);
  assert.deepEqual(de(comSaldo.id), ["controlado", 5, 0]);
  assert.deepEqual(de(reservado.id), ["controlado", 0, 0]);
  assert.deepEqual(de(semSaldo.id), ["desconhecido", null, 0]);
  assert.deepEqual(de(grade.id), ["controlado", 2, 2]);
  assert.deepEqual(
    { controlam: resumo.controlamEstoque, naoControlam: resumo.naoControlamEstoque, desconhecido: resumo.estoqueDesconhecido, comVariacoes: resumo.comVariacoes },
    { controlam: 4, naoControlam: 1, desconhecido: 1, comVariacoes: 1 },
  );

  assert.deepEqual(nomes(await consultar(t.slug, "estoque=zerado")), ["Todo reservado", "Zerado"]);
  assert.deepEqual(nomes(await consultar(t.slug, "estoque=com-saldo")), ["Com grade", "Com saldo"]);
  assert.deepEqual(nomes(await consultar(t.slug, "estoque=nao-controla")), ["Não controla"]);
  assert.deepEqual(nomes(await consultar(t.slug, "estoque=desconhecido")), ["Sem saldo cadastrado"]);
  assert.deepEqual(nomes(await consultar(t.slug, "ordem=estoque-desc")).slice(0, 2), ["Com saldo", "Com grade"]);
});

test("editar pelo painel da Ávila Ops: grava, e o histórico diz quem, quais campos, antes e depois", async () => {
  const t = await loja();
  const cat = await prisma.categoria.create({ data: { tenantId: t.id, slug: "polimento", nome: "Polimento" } });
  const p = await produto(t.id, { nome: "Boina", precoCentavos: 7005 });

  const r = await patch(t.slug, p.id, { autor: "Nicolas  Avila", versao: p.versaoCatalogo, precoCentavos: 7990, ativo: false, categoria: "polimento" });
  assert.equal(r.status, 200);
  assert.deepEqual(r.corpo.gravados, ["precoCentavos", "ativo", "categoria"]);
  assert.deepEqual({ preco: r.corpo.produto?.precoCentavos, ativo: r.corpo.produto?.ativo, categoria: r.corpo.produto?.categoria?.slug }, { preco: 7990, ativo: false, categoria: "polimento" });

  const gravado = await prisma.produto.findUniqueOrThrow({ where: { id: p.id } });
  assert.deepEqual({ preco: gravado.precoCentavos, ativo: gravado.ativo, categoria: gravado.categoriaId }, { preco: 7990, ativo: false, categoria: cat.id });
  // O preço oficial é o da variação: a edição passou pelo trilho, não só pela cópia no produto.
  const v = await prisma.variante.findFirstOrThrow({ where: { produtoId: p.id, padrao: true }, include: { preco: true } });
  assert.equal(v.preco?.valorCentavos, 7990);

  const historico = await prisma.historicoCatalogo.findMany({ where: { produtoId: p.id, origem: { startsWith: "avilaops:" } }, orderBy: { versao: "asc" } });
  assert.deepEqual(historico.map((h) => [h.origem, h.campos]), [["avilaops:Nicolas Avila", ["precoCentavos"]], ["avilaops:Nicolas Avila", ["ativo", "categoriaId"]]]);
  const [doPreco] = historico;
  assert.equal((doPreco.antes as { precoCentavos: number }).precoCentavos, 7005);
  assert.equal((doPreco.depois as { precoCentavos: number }).precoCentavos, 7990);

  // A ficha devolve o histórico só com os campos que mudaram.
  const f = await ficha(new Request("https://x/", { headers: { authorization: "Bearer token-de-teste-do-admin" } }), { params: Promise.resolve({ slug: t.slug, id: p.id }) });
  const { historico: naFicha } = (await f.json()) as { historico: Array<{ origem: string; campos: string[]; antes: Record<string, unknown>; depois: Record<string, unknown> }> };
  const ultima = naFicha.find((h) => h.campos.includes("precoCentavos") && h.origem.startsWith("avilaops:"))!;
  assert.deepEqual([ultima.antes, ultima.depois], [{ precoCentavos: 7005 }, { precoCentavos: 7990 }]);
});

test("editar em cima de versão velha não grava nada e não deixa histórico", async () => {
  const t = await loja();
  const p = await produto(t.id, { nome: "Concorrido", precoCentavos: 1000 });
  // Outra pessoa alterou o produto depois que esta abriu o cadastro.
  await salvarProdutoNoCatalogo(t.id, p.id, { nome: "Concorrido (renomeado)" }, { origem: "painel:dono" });

  for (const corpo of [{ precoCentavos: 2000 }, { ativo: false }]) {
    const r = await patch(t.slug, p.id, { autor: "QA", versao: p.versaoCatalogo, ...corpo });
    assert.equal(r.status, 409);
    assert.deepEqual(r.corpo.gravados, []);
  }
  const depois = await prisma.produto.findUniqueOrThrow({ where: { id: p.id } });
  assert.deepEqual({ preco: depois.precoCentavos, ativo: depois.ativo }, { preco: 1000, ativo: true });
  assert.equal(await prisma.historicoCatalogo.count({ where: { produtoId: p.id, origem: { startsWith: "avilaops:" } } }), 0);
});

test("editar recusa o que não pode: sem autor, campo fora da lista, categoria de outra loja, preço de produto com grade", async () => {
  const [t, outra] = [await loja(), await loja()];
  await prisma.categoria.create({ data: { tenantId: outra.id, slug: "so-da-outra", nome: "Só da outra" } });
  const p = await produto(t.id, { nome: "Recusas" });
  const base = { autor: "QA", versao: p.versaoCatalogo };

  assert.equal((await patch(t.slug, p.id, { versao: p.versaoCatalogo, ativo: false })).status, 422);
  assert.equal((await patch(t.slug, p.id, { ...base })).status, 422);
  assert.equal((await patch(t.slug, p.id, { ...base, estoque: 10 })).status, 422);
  assert.equal((await patch(t.slug, p.id, { ...base, nome: "Outro nome" })).status, 422);
  assert.equal((await patch(t.slug, p.id, { ...base, precoCentavos: -1 })).status, 422);
  assert.notEqual((await patch(t.slug, p.id, { ...base, categoria: "so-da-outra" })).status, 200);
  assert.equal((await prisma.produto.findUniqueOrThrow({ where: { id: p.id } })).categoriaId, null);

  const comGrade = await produto(t.id, { nome: "Com grade" });
  await salvarGradeNoCatalogo(t.id, comGrade.id, ["Cor"], [{ valores: { Cor: "Azul" }, precoCentavos: 1000, estoque: 1 }]);
  const atual = await prisma.produto.findUniqueOrThrow({ where: { id: comGrade.id } });
  const r = await patch(t.slug, comGrade.id, { autor: "QA", versao: atual.versaoCatalogo, precoCentavos: 5000 });
  assert.equal(r.status, 409);
  assert.match(r.corpo.erro ?? "", /variações/);
});

test("mandar o mesmo preço não cria versão nova no histórico", async () => {
  const t = await loja();
  const p = await produto(t.id, { nome: "Igual", precoCentavos: 1500 });
  const r = await patch(t.slug, p.id, { autor: "QA", versao: p.versaoCatalogo, precoCentavos: 1500 });
  assert.equal(r.status, 200);
  assert.deepEqual(r.corpo.gravados, []);
  assert.equal(r.corpo.produto?.versaoCatalogo, p.versaoCatalogo);
});

test("a origem do painel da loja leva o operador; o login principal é 'dono'", () => {
  assert.equal(origemDoPainel({ operador: null }), "painel:dono");
  assert.equal(origemDoPainel({ operador: { email: "  Maria@Loja.com.br " } }), "painel:maria@loja.com.br");
});
