import test from 'node:test';
import assert from 'node:assert/strict';
import { arquivos, referenciaRejeitada, planejar, conferirPlano } from './remover-referencias-bereta.mjs';

const rejeitada = 'https://lojas.avilaops.com/uploads/bereta-rodas/fabricante-cea8cac177272f6e55.webp';
const preservada = 'https://lojas.avilaops.com/uploads/bereta-rodas/foto-confirmada.webp';
const snapshot = () => ({
  tenant: { id: 'tenant-exemplo', slug: 'bereta-rodas', logoUrl: rejeitada, bannerUrl: null,
    tema: { premium: { editorialImagem: rejeitada, heroTitulo: 'Texto existente', logoEscuroUrl: preservada } }, identidade: {} },
  categorias: [{ id: 'categoria-exemplo', imagemUrl: preservada }],
  produtos: [{ id: 'produto-exemplo', slug: 'produto-exemplo', versaoCatalogo: 7, imagens: [preservada, rejeitada, rejeitada + '?w=480'] }],
});

test('only the eleven explicit paths, including existing image query variants', () => {
  assert.equal(arquivos.size, 11);
  assert.ok(referenciaRejeitada(rejeitada));
  assert.ok(referenciaRejeitada(rejeitada + '?w=480'));
  assert.ok(referenciaRejeitada('/uploads/bereta-rodas/fabricante-cea8cac177272f6e55.webp'));
  assert.equal(referenciaRejeitada(preservada), false);
});

test('preserve other hosts, stores, paths, text and the favicon', () => {
  for (const url of [rejeitada.replace('lojas.avilaops.com', 'empresa.example'), rejeitada.replace('/bereta-rodas/', '/outra-loja/'), rejeitada + '/extra', 'Texto ' + rejeitada, '//lojas.avilaops.com/uploads/bereta-rodas/fabricante-cea8cac177272f6e55.webp', '/media/bereta/brand/favicon/apple-touch-icon.png']) assert.equal(referenciaRejeitada(url), false, url);
});

test('plan removes only exact image leaves and preserves the product and theme text', () => {
  const original = snapshot();
  const before = structuredClone(original);
  const plan = planejar(original);
  assert.deepEqual(original, before);
  assert.equal(plan.tenant.logoUrl.depois, null);
  assert.deepEqual(plan.tenant.tema.depois, { premium: { heroTitulo: 'Texto existente', logoEscuroUrl: preservada } });
  assert.deepEqual(plan.produtos[0].depois, [preservada]);
  assert.equal(plan.produtos[0].versaoCatalogo, 7);
  assert.deepEqual(plan.categorias, []);
});

test('plan is empty after removal and preserves unrelated array content', () => {
  const original = snapshot();
  original.tenant.logoUrl = null;
  original.tenant.tema = { chamadas: [{ imagem: rejeitada, texto: 'Manter' }, { imagem: preservada }] };
  const plan = planejar(original);
  assert.deepEqual(plan.tenant.tema.depois, { chamadas: [{ texto: 'Manter' }, { imagem: preservada }] });
  original.tenant.tema = plan.tenant.tema.depois;
  original.produtos[0].imagens = plan.produtos[0].depois;
  const second = planejar(original);
  assert.deepEqual(second.tenant, {});
  assert.deepEqual(second.produtos, []);
});

test('reject another tenant and a tampered or changed plan', () => {
  const other = snapshot();
  other.tenant.slug = 'outra-loja';
  assert.throws(() => planejar(other), /INVALID_BERETA_TENANT/);
  const plan = planejar(snapshot());
  assert.doesNotThrow(() => conferirPlano(plan, plan.sha256));
  assert.throws(() => conferirPlano(plan, '0'.repeat(64)), /DIGEST/);
  plan.produtos[0].depois = [];
  assert.throws(() => conferirPlano(plan, plan.sha256), /DIGEST/);
});
