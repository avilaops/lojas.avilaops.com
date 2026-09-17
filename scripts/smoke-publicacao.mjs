#!/usr/bin/env node
// Smoke HTTP da versão publicada: responde, responde com banco, e responde
// com a folha de estilo que o navegador vai buscar.
//
// A folha de estilo é o motivo de o script existir. Em 02/09/2026 subiu um
// pacote sem `.next/static`: todas as páginas responderam 200, o healthcheck
// ficou verde e a loja apareceu sem CSS nenhum (a história está em
// `scripts/empacotar.sh`). `/api/health` não sabe se a folha existe; quem
// sabe é quem baixa o HTML e segue o <link> como o navegador segue.
//
// A foto do produto entrou pelo mesmo raciocínio, com um risco diferente: ela
// não vem do pacote, vem do volume `/uploads` montado no servidor. Volume não
// montado, remontado vazio ou com dono errado depois do `chown` do deploy não
// derruba nada — a loja sobe inteira, responde 200 em tudo e mostra um
// catálogo de imagens quebradas. Nenhuma verificação anterior via isso.
//
//   node scripts/smoke-publicacao.mjs https://lojas.avilaops.com
//   node scripts/smoke-publicacao.mjs            # usa SMOKE_URL ou o local
//
// Sai 0 com tudo verde, 1 na primeira falha. Sem dependência: roda no
// runner do pipeline antes de `npm ci`, e no servidor com o node do sistema.

const base = (process.argv[2] ?? process.env.SMOKE_URL ?? "http://127.0.0.1:3080").replace(/\/+$/, "");
const TENTATIVAS = Number(process.env.SMOKE_TENTATIVAS ?? 10);
const ESPERA_MS = Number(process.env.SMOKE_ESPERA_MS ?? 3000);

const verdes = [];
function ok(texto) { verdes.push(texto); console.log(`  ok  ${texto}`); }
function falhar(texto) {
  console.error(`  !!  ${texto}`);
  console.error(`\n!! smoke falhou em ${base} (${verdes.length} verificação(ões) verdes antes)`);
  process.exit(1);
}

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function buscar(caminho, init) {
  const alvo = caminho.startsWith("http") ? caminho : base + caminho;
  const controle = AbortSignal.timeout(Number(process.env.SMOKE_TIMEOUT_MS ?? 15000));
  return fetch(alvo, { redirect: "follow", cache: "no-store", signal: controle, ...init });
}

/** Espera a versão nova assumir a porta: deploy e pipeline chamam junto da troca. */
async function esperarDePe() {
  let ultimo = "";
  for (let i = 1; i <= TENTATIVAS; i++) {
    try {
      const r = await buscar("/api/health");
      if (r.status === 200 || r.status === 503) return r;
      ultimo = `HTTP ${r.status}`;
    } catch (e) { ultimo = e.message; }
    if (i < TENTATIVAS) { console.log(`  ..  tentativa ${i}/${TENTATIVAS} (${ultimo})`); await espera(ESPERA_MS); }
  }
  return falhar(`/api/health não respondeu em ${TENTATIVAS} tentativas: ${ultimo}`);
}

async function saude() {
  const r = await esperarDePe();
  if (r.status !== 200) falhar(`/api/health devolveu ${r.status}; o corpo diz ${await r.text()}`);
  if (!(r.headers.get("cache-control") ?? "").includes("no-store")) falhar("/api/health veio cacheável: um 200 guardado esconde a versão quebrada");
  const corpo = await r.json().catch(() => null);
  if (!corpo || corpo.ok !== true || corpo.banco !== "ok") falhar(`/api/health fora do contrato: ${JSON.stringify(corpo)}`);
  if (typeof corpo.latenciaBancoMs !== "number") falhar("/api/health sem latenciaBancoMs");
  ok(`/api/health 200, banco ok em ${corpo.latenciaBancoMs} ms`);
}

/** CT-17: sinal de vida da app no coletor, sem tocar no banco. */
async function sinalDeVida() {
  const r = await buscar("/v1/health");
  // O `/v1` só responde no domínio da plataforma, de propósito (gapp.ts): em
  // domínio de loja o 404 é a resposta certa, não uma falha do deploy.
  if (r.status === 404) return console.log("  --  /v1/health não responde aqui (domínio de loja), como esperado");
  if (r.status !== 200) falhar(`/v1/health devolveu ${r.status}`);
  const corpo = await r.json().catch(() => null);
  if (corpo?.status !== "ok" || !corpo?.version) falhar(`/v1/health fora do contrato: ${JSON.stringify(corpo)}`);
  ok(`/v1/health 200, versão ${corpo.version}`);
}

async function vitrineComEstilo() {
  const r = await buscar("/");
  if (!r.ok) falhar(`a página inicial devolveu ${r.status}`);
  const html = await r.text();
  const folhas = [...html.matchAll(/<link[^>]+rel="stylesheet"[^>]*>/g)]
    .map((m) => m[0].match(/href="([^"]+)"/)?.[1])
    .filter((href) => href && !href.startsWith("https://fonts."));
  if (folhas.length === 0) falhar("a página inicial não referencia nenhuma folha de estilo própria (pacote sem .next/static?)");
  for (const href of folhas) {
    const css = await buscar(href.startsWith("/") ? href : `/${href}`);
    if (!css.ok) falhar(`a folha ${href} devolveu ${css.status}: a loja abriria sem CSS`);
    const tipo = css.headers.get("content-type") ?? "";
    const texto = await css.text();
    if (!tipo.includes("css")) falhar(`a folha ${href} veio como ${tipo}`);
    if (texto.length < 1000) falhar(`a folha ${href} veio com ${texto.length} bytes; o build não terminou`);
    ok(`${href} servida com ${Math.round(texto.length / 1024)} kB de CSS`);
  }
  return html;
}

/**
 * A primeira foto de produto que a vitrine referencia.
 *
 * Três cuidados que a primeira versão não tinha, e sem os quais isto seria
 * decorativo ou, pior, ruidoso:
 *
 * 1. **Só `<img>`.** Pegar qualquer `src`/`href` com `/uploads/` alcançava o
 *    `<link rel="manifest">` e os ícones, que o Next emite antes do corpo:
 *    numa loja com favicon enviado, o smoke reprovava um deploy saudável por
 *    `application/manifest+json` não ser imagem.
 * 2. **O caminho, não a URL.** O upload é gravado absoluto para o domínio da
 *    plataforma (`src/lib/uploads.ts`), então seguir o endereço como está
 *    mediria o site público em vez do alvo — e um container novo, com o
 *    volume desmontado, passaria.
 * 3. **Furar o cache.** `/uploads` responde `max-age=31536000, immutable`;
 *    `cache: "no-store"` do Node vira `no-cache` na rede, que a borda ignora.
 *    Sem o parâmetro, um 200 guardado esconde origem vazia — o mesmo buraco
 *    que `saude()` evita pedindo `no-store` ao aplicativo.
 *
 * Só falha quando a vitrine **referencia** uma foto e ela não vem: loja sem
 * catálogo publicado, ou domínio da plataforma (que não tem `/uploads`),
 * passa sem reclamar. Inventar exigência onde não há foto transformaria o
 * smoke num alarme que todo mundo aprende a ignorar.
 */
async function fotosDaVitrine(html) {
  const candidatos = [...html.matchAll(/<img\b[^>]*>/gi)]
    .map((m) => m[0].match(/\bsrc="([^"]+)"/i)?.[1] ?? "")
    .map((href) => href.replace(/&amp;/g, "&"))
    .map((href) => {
      if (!href.includes("/_next/image")) return href;
      try {
        return new URL(href, base).searchParams.get("url") ?? "";
      } catch {
        return "";
      }
    })
    .filter((href) => href.includes("/uploads/"));

  if (!candidatos.length) return console.log("  --  a vitrine não referencia foto em /uploads (nada a conferir aqui)");

  let caminho = candidatos[0];
  try {
    caminho = new URL(candidatos[0], base).pathname;
  } catch {
    /* já é caminho */
  }
  const foto = await buscar(`${caminho}?smoke=${Date.now()}`);
  if (!foto.ok) falhar(`a foto ${caminho} devolveu ${foto.status}: o volume de uploads não está servindo, e a loja está com o catálogo quebrado`);
  const tipo = foto.headers.get("content-type") ?? "";
  if (!tipo.startsWith("image/")) falhar(`a foto ${caminho} veio como ${tipo}, não como imagem`);
  const bytes = Number(foto.headers.get("content-length") ?? 0) || (await foto.arrayBuffer()).byteLength;
  // Piso baixo de propósito: SVG enviado pelo lojista não passa pelo
  // otimizador e um ícone legítimo cabe em poucas centenas de bytes. O que
  // não existe é imagem de 60 bytes.
  if (bytes < 64) falhar(`a foto ${caminho} veio com ${bytes} bytes; é arquivo vazio ou truncado`);
  ok(`${caminho} servida com ${Math.round(bytes / 1024) || 1} kB de ${tipo.replace("image/", "")}`);
}

console.log(`==> smoke em ${base}`);
await saude();
await sinalDeVida();
await fotosDaVitrine(await vitrineComEstilo());
console.log(`\n==> ${verdes.length} verificação(ões) verdes em ${base}`);
