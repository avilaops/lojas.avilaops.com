import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { fecharSessao } from "@/lib/sessao";
import { COOKIE_SSO, configSSO } from "@/lib/sso";

/**
 * Logout local + global. Auth requires POST: a 303 redirect changes the method
 * to GET, so it cannot be used to log out of the central identity provider.
 * The intermediate page submits an explicit POST from the browser.
 */
export async function POST() {
  const hadSso = Boolean((await cookies()).get(COOKIE_SSO)?.value);
  await fecharSessao();

  const cfg = configSSO();
  if (!hadSso || !cfg) {
    return new Response(null, { status: 303, headers: {
      location: "/entrar?sso=saiu", "Cache-Control": "no-store",
    } });
  }

  const action = new URL("/api/auth/logout", cfg.url).toString();
  const nonce = randomBytes(16).toString("base64");
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Saindo da Ávila Ops</title></head><body style="font:16px system-ui;padding:2rem;max-width:34rem;margin:auto"><h1>Encerrando sessão</h1><p>Você está saindo do Lojas e da conta Ávila Ops.</p><form id="logout" method="post" action="${action}"><button type="submit">Concluir saída da Ávila Ops</button></form><script nonce="${nonce}">document.getElementById('logout').requestSubmit();</script></body></html>`;
  return new Response(html, { status: 200, headers: {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; form-action ${cfg.url}; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'`,
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
  } });
}
