import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext, compileFunction, createContext } from 'node:vm';

const nodes = new Map();
const chain = { add() { return this; }, to() { return this; }, group() { return this; } };
const capturar = definition => { nodes.set(definition.config.name, definition); return chain; };
const source = readFileSync(new URL('./workflow.n8n.js', import.meta.url), 'utf8');
runInNewContext(source.replace('export default ', 'globalThis.result = '), {
  node: capturar, trigger: capturar, workflow: () => chain, expr: value => value,
});

function executar(nome, entrada, json = {}, anterior = {}) {
  const codigo = nodes.get(nome).config.parameters.jsCode;
  const fn = compileFunction(codigo, ['$input', '$json', '$'], { parsingContext: createContext({}) });
  return fn({ all: () => entrada }, json, () => ({ item: { json: anterior } }));
}

test('workflow consulta apenas GET e não leva credencial aos domínios públicos', () => {
  const http = [...nodes.values()].filter(n => n.type === 'n8n-nodes-base.httpRequest');
  assert.equal(http.length, 3);
  assert.ok(http.every(n => n.config.parameters.method === 'GET'));
  assert.equal(nodes.get('Consultar paginas publicas').config.credentials, undefined);
  assert.equal(nodes.get('Listar lojas autorizadas').config.credentials.httpBearerAuth.id, 'BIftJgoyPwxr2d55');
});

test('duas lojas geram oito consultas sem exportar dados pessoais da lista', () => {
  const items = executar('Preparar verificacoes', [{ json: { slug: 'loja-a', dominioPrincipal: 'a.exemplo.com', loginEmail: 'privado@example.test' } },
    { json: { slug: 'loja-b', dominioPrincipal: 'b.exemplo.com', assinaturaId: 'nao-exportar' } }]);
  assert.equal(items.length, 8);
  assert.equal(items.filter(i => i.json.loja.slug === 'loja-b').length, 4);
  assert.ok(!JSON.stringify(items).includes('privado'));
  assert.ok(!JSON.stringify(items).includes('nao-exportar'));
});

test('respostas de duas lojas ficam em relatórios separados; transporte não vira sucesso', () => {
  const requests = executar('Preparar verificacoes', [{ json: { slug: 'loja-a', dominioPrincipal: 'a.exemplo.com' } },
    { json: { slug: 'loja-b', dominioPrincipal: 'b.exemplo.com' } }]);
  const resultados = requests.map(({ json: contexto }) => executar('Avaliar evidencias', [],
    contexto.loja.slug === 'loja-a' ? { statusCode: 200, body: '<html><title>A</title><h1>A</h1></html>' }
      : { error: 'Falha de rede' }, contexto));
  const relatorios = executar('Relatorio por loja', resultados);
  assert.equal(relatorios.length, 2);
  assert.equal(relatorios[1].json.loja.slug, 'loja-b');
  assert.equal(relatorios[1].json.cobertura.bloqueado, 4);
  assert.equal(relatorios[1].json.prontidaoComercial, 'NAO_CERTIFICADA');
  assert.ok(relatorios[1].json.testes.every(t => !t.url.includes('a.exemplo.com')));
});
