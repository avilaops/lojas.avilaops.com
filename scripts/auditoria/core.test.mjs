import test from 'node:test';
import assert from 'node:assert/strict';
import { validarLoja, extrairPagina, urlsDoSitemap, analisarResposta, concluir, revisoesPendentes } from './core.mjs';

const loja = validarLoja({ slug: 'pkvedacoes', url: 'https://pkvedacoes.com.br', objetivo: 'compra-online' });

test('rejeita credenciais, rede local e caminhos no manifesto', () => {
  for (const url of ['http://localhost', 'https://127.0.0.1', 'https://x:segredo@exemplo.com', 'https://exemplo.com/api', 'https://exemplo.com?q=token']) {
    assert.throws(() => validarLoja({ slug: 'x', url }));
  }
  assert.throws(() => validarLoja({ slug: '../x', url: 'https://exemplo.com' }));
});

test('extrai atributos em outra ordem, aspas simples e JSON-LD em grafo', () => {
  const p = extrairPagina(`<TITLE>Peça</TITLE><meta content='Medidas' name='description'><link href='https://pkvedacoes.com.br/p' rel='canonical'><h1>Peça</h1><script type='application/ld+json'>{"@graph":[{"@type":"Product","sku":"X"}]}</script>`);
  assert.equal(p.descricao, 'Medidas');
  assert.equal(p.dados[0].sku, 'X');
  assert.equal(p.h1, 1);
});

test('não aprova dado estruturado inválido nem transforma timeout em falha da loja', () => {
  const testes = analisarResposta(loja, 'home', { url: loja.url, status: 200, corpo: '<script type="application/ld+json">{</script>' });
  assert.equal(testes.find(t => t.id === 'home.jsonld').estado, 'FALHOU');
  const timeout = analisarResposta(loja, 'home', { url: loja.url, erro: 'Timeout' });
  assert.equal(timeout[0].estado, 'BLOQUEADO');
});

test('sitemap externo não é seguido e duplicatas são removidas', () => {
  const mapa = urlsDoSitemap('<urlset><loc>https://pkvedacoes.com.br/produtos/x</loc><loc>https://pkvedacoes.com.br/produtos/x</loc><loc>https://externo.com/</loc></urlset>', loja.url);
  assert.equal(mapa.urls.length, 1);
  assert.equal(mapa.externas, 1);
});

test('feed vazio depende do objetivo, não presume defeito em catálogo assistido', () => {
  const resposta = { url: loja.url + '/feed/merchant.xml', status: 200, corpo: '<rss><channel/></rss>' };
  assert.equal(analisarResposta(loja, 'merchant', resposta)[1].estado, 'FALHOU');
  assert.equal(analisarResposta({ ...loja, objetivo: 'pedido-assistido' }, 'merchant', resposta)[1].estado, 'NAO_TESTADO');
});

test('cobertura parcial nunca certifica venda nem aprova revisão não executada', () => {
  const r = concluir(loja, revisoesPendentes(loja));
  assert.equal(r.status, 'PARCIAL');
  assert.equal(r.prontidaoComercial, 'NAO_CERTIFICADA');
  assert.equal(r.cobertura.naoTestado, 9);
});
