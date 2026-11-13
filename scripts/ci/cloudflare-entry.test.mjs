import test from 'node:test';
import assert from 'node:assert/strict';
let worker;
try { worker = (await import('../../deploy/cloudflare/entry-worker.mjs')).default; }
catch (error) { if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error; }
const env = { ORIGIN: 'https://lojas-avilaops-emergency.onrender.com', PUBLIC_BASE: 'lojas.avilaops.com', CUSTOM_HOSTS: 'vedashow.com.br,www.vedashow.com.br' };
async function run(request, fetcher) {
  assert.equal(typeof worker?.fetch, 'function', 'Entrada Cloudflare precisa estar implementada');
  return worker.fetch(request, env, { fetch: fetcher });
}

test('entrada preserva POST e cookie, substitui host forjado e não segue redirects', async () => {
  let received;
  const response = await run(new Request('https://lojas.avilaops.com/api/painel/loja?modo=1', {
    method: 'POST', body: 'corpo-sintetico', headers: { cookie: 'lojas_sessao=sintetica', 'content-type': 'text/plain', 'x-forwarded-host': 'atacante.example', 'x-forwarded-proto': 'http', forwarded: 'host=atacante.example', 'x-plataforma': '1' },
  }), async (request, options) => {
    received = request;
    assert.equal(await request.text(), 'corpo-sintetico');
    assert.equal(options.cache, 'no-store', 'Fetch autenticado deve ignorar o cache antes de chamar a origem');
    assert.equal(options.cf?.cacheTtl, undefined, 'cacheTtl zero ainda força armazenamento');
    return new Response('ok');
  });
  assert.equal(response.status, 200);
  assert.equal(received.url, env.ORIGIN + '/api/painel/loja?modo=1');
  assert.equal(received.redirect, 'manual');
  assert.equal(received.headers.get('x-forwarded-host'), 'lojas.avilaops.com');
  assert.equal(received.headers.get('x-forwarded-proto'), 'https');
  assert.equal(received.headers.get('forwarded'), null);
  assert.equal(received.headers.get('x-plataforma'), null, 'Marcador interno não pode vir do cliente');
  assert.equal(received.headers.get('cookie'), 'lojas_sessao=sintetica');
  assert.match(response.headers.get('cache-control'), /no-store/);
});

test('marcador interno forjado é removido antes de chamar uma loja', async () => {
  await run(new Request('https://demo.lojas.avilaops.com/', { headers: { 'x-plataforma': '1' } }), async request => {
    assert.equal(request.headers.get('x-plataforma'), null);
    return new Response('vitrine');
  });
});

test('Location técnica volta ao host público, OAuth externo e Set-Cookie são preservados', async () => {
  const headers = new Headers({ location: env.ORIGIN + '/painel?retorno=1' });
  headers.append('set-cookie', 'lojas_sessao=sintetica; Secure; HttpOnly; SameSite=Lax');
  headers.append('set-cookie', 'outra=sintetica; Secure; HttpOnly');
  const response = await run(new Request('https://vedashow.com.br/entrar'), async () => new Response(null, { status: 303, headers }));
  assert.equal(response.headers.get('location'), 'https://vedashow.com.br/painel?retorno=1');
  assert.equal(response.headers.getSetCookie().length, 2);
  assert.ok(response.headers.getSetCookie().every(c => c.includes('Secure') && c.includes('HttpOnly')));
  const oauth = 'https://auth.avilaops.com/login?returnTo=https%3A%2F%2Flojas.avilaops.com%2Fapi%2Fpainel%2Fentrar%2Fsso';
  const external = await run(new Request('https://lojas.avilaops.com/entrar'), async () => new Response(null, { status: 302, headers: { location: oauth } }));
  assert.equal(external.headers.get('location'), oauth);
});

test('hosts desconhecidos, slug com múltiplos níveis e origem HTTP não viram proxy aberto', async () => {
  for (const host of ['atacante.example', 'a.b.lojas.avilaops.com', 'lojas.avilaops.com.atacante.example']) {
    const response = await run(new Request('https://' + host + '/'), () => assert.fail('Host inválido não deve chamar origem'));
    assert.equal(response.status, 421);
  }
  assert.equal((await run(new Request('http://demo.lojas.avilaops.com/?q=1'), () => assert.fail('Redirecionar para HTTPS'))).headers.get('location'), 'https://demo.lojas.avilaops.com/?q=1');
});

test('resposta com sessão e falha de upstream não ficam em cache', async () => {
  const privateResponse = await run(new Request('https://demo.lojas.avilaops.com/'), async () => new Response('conteudo', { headers: { 'set-cookie': 'loja_conta=sintetica', 'cache-control': 'public, max-age=3600' } }));
  assert.match(privateResponse.headers.get('cache-control'), /private.*no-store/);
  const unavailable = await run(new Request('https://lojas.avilaops.com/api/health'), async () => { throw new Error('upstream'); });
  assert.equal(unavailable.status, 503);
  assert.match(unavailable.headers.get('cache-control'), /no-store/);
});
