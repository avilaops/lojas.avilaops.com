import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
assert.equal(process.env.CI, 'true', 'Verificação exclusiva do GitHub CI');
const origin = 'http://127.0.0.1:3107';
const server = spawn(process.execPath, ['.next/standalone/server.js'], { env: {
  ...process.env, PORT: '3107', HOSTNAME: '0.0.0.0', LOJAS_BASE_DOMAIN: 'lojas.avilaops.com',
  ROTINAS_AGENDADOR: '0', SSO_APP_ID: 'lojas-avilaops-com', SSO_URL: 'https://auth.example',
  LOJAS_OIDC_CLIENT_ID: '', LOJAS_OIDC_CLIENT_SECRET: '', LOJAS_OIDC_REDIRECT_URI: '',
}, stdio: 'inherit' });
try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch(origin + '/api/health')).status === 200) { ready = true; break; } } catch { /* aguarda runtime */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert.ok(ready, 'Runtime aprovado inicia');
  const response = await fetch(origin + '/api/painel/entrar/iniciar-sso', { redirect: 'manual', headers: { host: 'backend-render.example', 'x-forwarded-host': 'lojas.avilaops.com', 'x-forwarded-proto': 'https' } });
  assert.equal(response.status, 307, 'SSO deve reconhecer o host público atrás do Worker');
  assert.equal(response.headers.get('location'), 'https://lojas.avilaops.com/api/painel/entrar/sso');
  assert.ok(response.headers.getSetCookie().some(c => c.includes('HttpOnly') && c.includes('Secure')));
  const wrong = await fetch(origin + '/api/painel/entrar/iniciar-sso', { redirect: 'manual', headers: { host: 'backend-render.example', 'x-forwarded-host': 'demo.lojas.avilaops.com' } });
  assert.equal(wrong.status, 404, 'SSO continua restrito ao domínio da plataforma');
  console.log(JSON.stringify({ cloudflareHostSso: 'pass', wrongTenantHost: 'denied' }));
} finally { server.kill('SIGTERM'); }
