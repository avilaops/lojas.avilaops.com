import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Exact references rejected by the owner. Never infer ownership from a prefix.
export const arquivos = new Set([
  'mve5erxb-178e0cb7.webp', 'mve5esx7-572f1b9b.webp',
  'bereta-performance-20261024-desktop.webp',
  'fabricante-cea8cac177272f6e55.webp', 'fabricante-d493dc652bf18c429d.webp',
  'fabricante-c92cc7ef9b53d9bbe3.webp', 'fabricante-ec84c1c267fb0baacc.webp',
  'fabricante-419720f6c758774039.webp', 'fabricante-086fa0c58ca18322af.webp',
  'bereta-rodas-editorial-20261024.webp', 'bereta-pneus-editorial-20261024.webp',
]);
const slug = 'bereta-rodas';
const base = `https://${slug}.lojas.avilaops.com`;
const retirada = Symbol('retirada');
const igual = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

export function referenciaRejeitada(value) {
  if (typeof value !== 'string' || !(value.startsWith('https://') || value.startsWith('/')) || value.startsWith('//')) return false;
  try {
    const u = new URL(value, base);
    if (!['lojas.avilaops.com', `${slug}.lojas.avilaops.com`].includes(u.hostname) || u.protocol !== 'https:' || u.port || u.username || u.password) return false;
    const prefixo = `/uploads/${slug}/`;
    return u.pathname.startsWith(prefixo) && arquivos.has(u.pathname.slice(prefixo.length));
  } catch { return false; }
}

function limpar(value) {
  if (referenciaRejeitada(value)) return retirada;
  if (Array.isArray(value)) return value.map(limpar).filter(v => v !== retirada);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, limpar(v)]).filter(([, v]) => v !== retirada));
  return value;
}

export function planejar(snapshot) {
  if (snapshot.tenant?.slug !== slug || !snapshot.tenant.id) throw new Error('INVALID_BERETA_TENANT');
  const tenant = {};
  for (const field of ['logoUrl', 'bannerUrl', 'tema', 'identidade']) {
    const value = limpar(snapshot.tenant[field]);
    const depois = value === retirada ? null : value;
    if (!igual(depois, snapshot.tenant[field])) tenant[field] = { antes: snapshot.tenant[field], depois };
  }
  const categorias = snapshot.categorias.filter(c => referenciaRejeitada(c.imagemUrl)).map(c => ({ ...c, depois: null }));
  const produtos = snapshot.produtos.filter(p => p.imagens.some(referenciaRejeitada)).map(p => ({
    id: p.id, slug: p.slug, versaoCatalogo: p.versaoCatalogo,
    antes: p.imagens, depois: p.imagens.filter(u => !referenciaRejeitada(u)),
  }));
  const changes = { schemaVersion: 1, tenantId: snapshot.tenant.id, slug, tenant, categorias, produtos };
  return { ...changes, sha256: hash(changes) };
}

export function conferirPlano(plan, digest) {
  const { sha256, ...changes } = plan;
  if (plan.schemaVersion !== 1 || plan.slug !== slug || !/^[a-f0-9]{64}$/.test(digest ?? '') || sha256 !== digest || hash(changes) !== digest) throw new Error('INVALID_BERETA_PLAN_DIGEST');
}

const quantidade = plan => Object.keys(plan.tenant).length + plan.categorias.length + plan.produtos.length;
const resumo = plan => ({ tenant: slug, sha256: plan.sha256, camposDaLoja: Object.keys(plan.tenant), categorias: plan.categorias.length, produtos: plan.produtos.length });

async function snapshotDo(db) {
  return db.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ, READ ONLY');
    await tx.$executeRawUnsafe('SET LOCAL statement_timeout = 15000');
    const tenant = await tx.tenant.findUnique({ where: { slug }, select: { id: true, slug: true, logoUrl: true, bannerUrl: true, tema: true, identidade: true } });
    if (!tenant) throw new Error('BERETA_TENANT_NOT_FOUND');
    const produtos = await tx.produto.findMany({ where: { tenantId: tenant.id }, orderBy: { id: 'asc' }, select: { id: true, slug: true, imagens: true, versaoCatalogo: true, nome: true, ativo: true, precoCentavos: true, precoDeCentavos: true, estoque: true } });
    if (produtos.length > 10000) throw new Error('BERETA_PRODUCT_BOUND_EXCEEDED');
    const categorias = await tx.categoria.findMany({ where: { tenantId: tenant.id }, orderBy: { id: 'asc' }, select: { id: true, imagemUrl: true } });
    const midias = await tx.midiaProduto.findMany({ where: { tenantId: tenant.id }, select: { produtoId: true, varianteId: true, url: true } });
    for (const midia of midias.filter(m => referenciaRejeitada(m.url))) {
      if (midia.varianteId || !produtos.some(p => p.id === midia.produtoId && p.imagens.includes(midia.url))) throw new Error('BERETA_MEDIA_REQUIRES_SEPARATE_REVIEW');
    }
    const protecao = hash(produtos.map(({ imagens: _imagens, versaoCatalogo: _versao, ...p }) => p));
    return { tenant, produtos, categorias, protecao, totalProdutos: produtos.length };
  }, { timeout: 25000 });
}

async function executar() {
  const [modo, pasta, digest] = process.argv.slice(2);
  if (!['planejar', 'aplicar'].includes(modo) || !pasta) throw new Error('INVALID_BERETA_OPERATION');
  const url = new URL(process.env.DATABASE_URL);
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || decodeURIComponent(url.pathname) !== '/lojas' || ['localhost', '127.0.0.1', '::1'].includes(url.hostname)) throw new Error('INVALID_BERETA_PRODUCTION_DATABASE');
  const { prisma } = await import('../../src/lib/db.ts');
  try {
    await mkdir(pasta, { recursive: true });
    const snapshot = await snapshotDo(prisma);
    const plan = planejar(snapshot);
    if (modo === 'planejar') {
      await writeFile(path.join(pasta, 'plan.json'), JSON.stringify({ ...plan, protecao: snapshot.protecao, totalProdutos: snapshot.totalProdutos }, null, 2));
      console.log(JSON.stringify(resumo(plan)));
      return;
    }
    const saved = JSON.parse(await readFile(path.join(pasta, 'plan.json'), 'utf8'));
    const { protecao, totalProdutos, ...savedPlan } = saved;
    conferirPlano(savedPlan, digest);
    if (plan.sha256 !== digest || snapshot.protecao !== protecao || snapshot.totalProdutos !== totalProdutos) throw new Error('BERETA_CHANGED_SINCE_BACKUP');
    const { salvarProdutoNoCatalogo } = await import('../../src/lib/catalogo-escrita.ts');
    const completed = [];
    const registrar = async item => {
      completed.push(item);
      await writeFile(path.join(pasta, 'applied.json'), JSON.stringify({ sha256: digest, completed }, null, 2));
    };
    if (Object.keys(plan.tenant).length) {
      await prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT id FROM "Tenant" WHERE id=${plan.tenantId} AND slug=${slug} FOR UPDATE`;
        const atual = await tx.tenant.findUnique({ where: { id: plan.tenantId }, select: { id: true, slug: true, logoUrl: true, bannerUrl: true, tema: true, identidade: true } });
        if (!atual || atual.slug !== slug || Object.entries(plan.tenant).some(([key, change]) => !igual(atual[key], change.antes))) throw new Error('BERETA_TENANT_CHANGED');
        await tx.tenant.update({ where: { id: plan.tenantId }, data: Object.fromEntries(Object.entries(plan.tenant).map(([key, change]) => [key, change.depois])) });
      });
      await registrar({ tipo: 'tenant', campos: Object.keys(plan.tenant) });
    }
    for (const c of plan.categorias) {
      const result = await prisma.categoria.updateMany({ where: { id: c.id, tenantId: plan.tenantId, imagemUrl: c.imagemUrl }, data: { imagemUrl: null } });
      if (result.count !== 1) throw new Error('BERETA_CATEGORY_CHANGED');
      await registrar({ tipo: 'categoria', id: c.id });
    }
    for (const p of plan.produtos) {
      // The normal writer preserves media associations, version, history and outbox.
      await salvarProdutoNoCatalogo(plan.tenantId, p.id, { imagens: p.depois }, { versao: p.versaoCatalogo, origem: 'operacao:bereta-referencias-rejeitadas-20261114' });
      await registrar({ tipo: 'produto', id: p.id, slug: p.slug });
    }
    const depois = await snapshotDo(prisma);
    if (quantidade(planejar(depois)) || depois.protecao !== protecao || depois.totalProdutos !== totalProdutos) throw new Error('BERETA_POSTCONDITION_FAILED');
    const verification = { ...resumo(plan), referencesRemoved: true, productCountPreserved: true, productCommercialFieldsPreserved: true, originalFilesDeleted: false, totalProdutos };
    await writeFile(path.join(pasta, 'verification.json'), JSON.stringify(verification, null, 2));
    console.log(JSON.stringify(verification));
  } finally { await prisma.$disconnect(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) executar().catch(error => {
  console.error(/^[A-Z_0-9]+$/.test(error?.message ?? '') ? error.message : 'BERETA_OPERATION_FAILED');
  process.exitCode = 1;
});
