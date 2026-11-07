import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { after, test } from "node:test";
import { prisma } from "../../src/lib/db";
import { permitirProjecao, salvarGradeNoCatalogo, salvarProdutoNoCatalogo } from "../../src/lib/catalogo-escrita";
import { itensMerchant } from "../../src/lib/catalogo-merchant";
import { pertenceAGrade } from "../../src/lib/catalogo-oferta";
import { INCLUIR_CATALOGO, midiasDaOferta, type ProdutoCatalogo } from "../../src/lib/catalogo-qualidade";
import { resolverItensPadronizados } from "../../src/lib/catalogo-resolver";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "5548" || !url.pathname.endsWith("_test")) {
  throw new Error("Este teste exige o banco isolado local :5548/*_test.");
}
after(() => prisma.$disconnect());

const skus = [
  "ISO155", "ISO202", "ISO189", "ISO276", "ISO287", "ISO245", "ISO244",
  "ISO001", "ISO002", "ISO003", "ISO095", "ISO184", "ISO007", "ISO008",
  "ISO283", "ISO009", "ISO011", "ISO150", "ISO013", "ISO017", "ISO018", "ISO019",
];
const foto = (sku: string) => `https://qa.example/${sku}.webp`;
const executarSql = (script: string) => execFileSync("psql", [
  "-X", "-v", "ON_ERROR_STOP=1", "--dbname", url.toString(), "--file", `scripts/catalogo/${script}.sql`,
], { encoding: "utf8" });
const converter = () => executarSql("agrupar-apresentacoes-domirio");

test("Domi-Rio isola fotos no Merchant, conserva a grade e respeita versões B2B aprovadas", async () => {
  const tenant = await prisma.tenant.create({ data: { slug: "domi-rio", nome: "QA Domi-Rio", status: "ATIVA" } });
  const produtos = new Map<string, ProdutoCatalogo>();
  const original = (sku: string | null) => {
    const p = produtos.get(sku ?? "");
    assert.ok(p, `Produto de teste ${sku} não encontrado`);
    return p;
  };
  for (const [indice, sku] of skus.entries()) {
    const p = await salvarProdutoNoCatalogo(tenant.id, null, {
      nome: `Produto ${sku}`, slug: sku.toLowerCase(), sku, precoCentavos: 1500 + indice,
      precoDeCentavos: 2500, estoque: 10 + indice, descricao: "Produto de teste.",
      ...(sku === "ISO155" ? { gtin: "4006381333931" } : {}),
      imagens: sku === "ISO189" ? [] : [foto(sku)],
    });
    produtos.set(sku, await prisma.produto.findUniqueOrThrow({ where: { id: p.id }, include: INCLUIR_CATALOGO }));
  }
  const aprovado = original("ISO287");
  const rascunho = original("ISO202");
  const regraPorProduto = original("ISO245");
  const catalogo = await prisma.catalogoB2B.create({ data: { tenantId: tenant.id, referencia: "QA-DOMIRIO", nome: "QA Domi-Rio" } });
  const novaVersao = (versao: number) => prisma.versaoCatalogoB2B.create({
    data: { tenantId: tenant.id, catalogoId: catalogo.id, versao, vigenteDesde: new Date("2026-11-01T00:00:00Z") },
  });
  const versaoAprovada = await novaVersao(1);
  const versaoRascunho = await novaVersao(2);
  const item = (versaoId: string, produtoId: string, varianteId: string | null) => prisma.itemCatalogoB2B.create({
    data: {
      tenantId: tenant.id, versaoId, produtoId, varianteId, acao: "INCLUIR", estrategiaPreco: "FIXO",
      precoFixoCentavos: 900, quantidadeMinima: 1, multiploVenda: 1, quantidadePorEmbalagem: 1,
      unidadeComercial: "UN", unidadesBaseNumerador: 1, unidadesBaseDenominador: 1,
    },
  });
  const itemAprovado = await item(versaoAprovada.id, aprovado.id, aprovado.variantes[0].id);
  const itemRascunho = await item(versaoRascunho.id, rascunho.id, rascunho.variantes[0].id);
  const itemPorProduto = await item(versaoRascunho.id, regraPorProduto.id, null);
  const versaoCongelada = await prisma.versaoCatalogoB2B.update({
    where: { id: versaoAprovada.id },
    data: { estado: "APROVADA", aprovadoEm: new Date(), aprovadoPor: "qa@example.test", conteudoHash: "a".repeat(64) },
  });

  converter();
  const carregar = (id: string) => prisma.produto.findUniqueOrThrow({ where: { id }, include: INCLUIR_CATALOGO });
  const raiz = await carregar(original("ISO155").id);
  assert.deepEqual(raiz.opcoes, ["Volume"]);
  assert.equal((await carregar(aprovado.id)).ativo, true);
  assert.equal((await carregar(original("ISO244").id)).ativo, true);
  assert.deepEqual(await prisma.versaoCatalogoB2B.findUnique({ where: { id: versaoCongelada.id } }), versaoCongelada);
  assert.deepEqual(await prisma.itemCatalogoB2B.findUnique({ where: { id: itemAprovado.id } }), itemAprovado);
  assert.deepEqual(await prisma.itemCatalogoB2B.findUnique({ where: { id: itemPorProduto.id } }), itemPorProduto);
  assert.deepEqual(await prisma.itemCatalogoB2B.findUnique({ where: { id: itemRascunho.id } }), { ...itemRascunho, produtoId: raiz.id });
  await assert.rejects(() => prisma.itemCatalogoB2B.update({ where: { id: itemAprovado.id }, data: { precoFixoCentavos: 1 } }), /imutável/);

  const grade = raiz.variantes.filter(v => v.ativo && pertenceAGrade(raiz.opcoes, v));
  assert.deepEqual(grade.map(v => v.sku), ["ISO155", "ISO202", "ISO189"]);
  for (const [indice, v] of grade.entries()) {
    const anterior = original(v.sku).variantes[0];
    assert.equal(v.id, anterior.id);
    assert.equal(v.gtin, anterior.gtin);
    assert.deepEqual(v.preco, anterior.preco);
    assert.deepEqual(v.saldos, anterior.saldos);
    assert.deepEqual(v.publicacoes, anterior.publicacoes);
    assert.deepEqual(midiasDaOferta(raiz, v.id).map(m => m.url), indice === 2 ? [] : [foto(v.sku!)]);
  }
  const anuncios = itensMerchant(raiz, "https://qa.example");
  assert.equal(anuncios.length, 2);
  for (const [indice, anuncio] of anuncios.entries()) {
    assert.ok(anuncio.includes(`<g:image_link>${foto(grade[indice].sku!)}</g:image_link>`));
    assert.ok(!anuncio.includes("<g:additional_image_link>"));
  }
  assert.deepEqual((await carregar(rascunho.id)).midias, rascunho.midias);
  const carrinho = await resolverItensPadronizados(tenant.id, grade.map(v => ({ id: `${raiz.id}:${v.id}`, quantidade: 1 })));
  assert.deepEqual(carrinho.map(item => item.imagem), [foto("ISO155"), foto("ISO202"), undefined]);
  converter();
  assert.deepEqual(await carregar(raiz.id), raiz);

  const entradas = grade.map(v => ({
    id: v.id, valores: v.valores as Record<string, string>, precoCentavos: v.preco!.valorCentavos,
  }));
  await assert.rejects(() => salvarGradeNoCatalogo(tenant.id, raiz.id, raiz.opcoes, entradas.slice(1), raiz.versaoCatalogo), /Mantenha a apresentação padrão/);
  await salvarGradeNoCatalogo(tenant.id, raiz.id, raiz.opcoes, entradas, raiz.versaoCatalogo);
  const atual = await carregar(raiz.id);
  assert.deepEqual(atual.variantes, raiz.variantes);
  assert.deepEqual(atual.midias, raiz.midias);

  const fichasCypertryne = [
    ["ISO014", "100 mL", "cypertryne-100", "mw3zdh0l-c28efd58", "mw3ze4tc-a1400f1e"],
    ["ISO140", "35 mL", "cypertryne-35", "mw1jk2dz-cc45b336"],
    ["ISO015", "1 L", "cypertryne-1000", "mw1jhopy-b5cf84a9", "mw3zfcc1-a30a8292"],
  ];
  const urlFoto = (nome: string) => `https://lojas.avilaops.com/uploads/domi-rio/${nome}.webp`;
  let raizCypertryne = "";
  for (const [sku, volume, slug, ...arquivos] of fichasCypertryne) {
    const ficha = await salvarProdutoNoCatalogo(tenant.id, null, {
      nome: `CYPERTRYNE ${volume}`, sku, slug, precoCentavos: 1000, imagens: arquivos.map(urlFoto),
    });
    const variante = await prisma.variante.findFirstOrThrow({ where: { produtoId: ficha.id, padrao: true } });
    if (!raizCypertryne) {
      raizCypertryne = ficha.id;
      await prisma.$transaction(async tx => {
        await permitirProjecao(tx);
        await tx.produto.update({ where: { id: ficha.id }, data: { opcoes: ["Volume"] } });
      });
    } else {
      await prisma.produto.update({ where: { id: ficha.id }, data: { ativo: false } });
    }
    await prisma.variante.update({ where: { id: variante.id }, data: {
      produtoId: raizCypertryne, padrao: ficha.id === raizCypertryne, valores: { Volume: volume },
    } });
  }
  executarSql("vincular-fotos-cypertryne-domirio");
  const cypertryne = await carregar(raizCypertryne);
  assert.equal(cypertryne.nome, "CYPERTRYNE");
  for (const [sku, , , ...arquivos] of fichasCypertryne) {
    const variante = cypertryne.variantes.find(v => v.sku === sku);
    assert.ok(variante);
    assert.deepEqual(midiasDaOferta(cypertryne, variante.id).map(m => m.url), arquivos.map(urlFoto));
  }
  executarSql("vincular-fotos-cypertryne-domirio");
  assert.equal((await carregar(raizCypertryne)).versaoCatalogo, cypertryne.versaoCatalogo);
});
