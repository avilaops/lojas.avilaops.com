// HTTPS ingress only. Durable application state stays in PostgreSQL and R2.
const privateHeaders = { 'cache-control': 'private, no-store, max-age=0', 'x-content-type-options': 'nosniff' };
const unavailable = () => new Response('Serviço temporariamente indisponível.', { status: 503, headers: privateHeaders });

export default {
  async fetch(request, env, context) {
    let origin;
    try { origin = new URL(env.ORIGIN); } catch { return unavailable(); }
    if (origin.protocol !== 'https:' || !origin.hostname.endsWith('.onrender.com') || origin.port || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash) return unavailable();
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    const base = env.PUBLIC_BASE ?? 'lojas.avilaops.com';
    const slug = host.endsWith('.' + base) ? host.slice(0, -(base.length + 1)) : '';
    const custom = new Set((env.CUSTOM_HOSTS ?? '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean));
    if (host !== base && !/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug) && !custom.has(host)) return new Response(null, { status: 421, headers: privateHeaders });
    if (url.protocol !== 'https:') { url.protocol = 'https:'; return new Response(null, { status: 308, headers: { ...privateHeaders, location: url.href } }); }
    const headers = new Headers(request.headers);
    for (const name of ['host', 'forwarded', 'x-forwarded-host', 'x-forwarded-proto', 'x-forwarded-port', 'x-original-host', 'x-original-url', 'x-real-ip', 'x-forwarded-for', 'x-plataforma']) headers.delete(name);
    headers.set('x-forwarded-host', host);
    headers.set('x-forwarded-proto', 'https');
    const visitor = request.headers.get('cf-connecting-ip');
    if (visitor) { headers.set('x-forwarded-for', visitor); headers.set('x-real-ip', visitor); }
    // Assign path/search separately: a pathname starting // must not change origin.
    const target = new URL(origin);
    target.pathname = url.pathname;
    target.search = url.search;
    try {
      const upstream = new Request(target, { method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body, duplex: 'half', redirect: 'manual' });
      const response = await (context?.fetch ?? fetch)(upstream, { cache: 'no-store' });
      const output = new Headers(response.headers);
      const location = output.get('location');
      if (location) {
        const destination = new URL(location, origin);
        if (destination.origin === origin.origin) { destination.protocol = 'https:'; destination.host = host; output.set('location', destination.href); }
      }
      const sensitive = !['GET', 'HEAD'].includes(request.method) || request.headers.has('cookie') || request.headers.has('authorization') || output.has('set-cookie') || /^\/(?:api|v1|oauth|entrar|painel|conta|admin|ml|canais|melhor-envio|mercado-pago)(?:\/|$)/.test(url.pathname);
      if (sensitive) output.set('cache-control', privateHeaders['cache-control']);
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers: output });
    } catch { return unavailable(); }
  },
};
