// Private, authenticated object access. No browser CORS, public listing, or origin fallback.
const resposta = (status, headers = {}) => new Response(null, { status, headers: { "cache-control": "no-store", ...headers } });
function igual(a, b) {
  if (!/^[a-f0-9]{64}$/.test(b ?? "") || a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

export default {
  async fetch(request, env) {
    const token = /^Bearer ([a-zA-Z0-9_-]{16,256})$/.exec(request.headers.get("authorization") ?? "")?.[1];
    if (!token) return resposta(401);
    const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)))].map(b => b.toString(16).padStart(2, "0")).join("");
    const app = igual(digest, env.APP_TOKEN_SHA256);
    const publisher = igual(digest, env.PUBLISH_TOKEN_SHA256);
    if (!app && !publisher) return resposta(401);
    const url = new URL(request.url);
    const [area, ...partes] = url.pathname.slice(1).split("/");
    if (url.search || url.pathname.length > 1200 || !partes.length || partes.some(p => !/^[a-z0-9][a-z0-9._-]*$/i.test(p) || p.includes(".."))) return resposta(400);
    const chave = partes.join("/");
    const bucket = { uploads: env.UPLOADS, fiscal: env.FISCAL, releases: env.RELEASES, backups: env.BACKUPS }[area];
    if (!bucket) return resposta(404);
    if ((area === "uploads" || area === "fiscal") && !app) return resposta(403);
    if (area === "backups" && !publisher) return resposta(403);
    if (area === "releases" && !/^[a-f0-9]{40}(?:-\d+-\d+)?\/(?:part-\d{2}|manifest\.json)$/.test(chave)) return resposta(400);
    if (request.method === "PUT" && (area === "releases" || area === "backups") && !publisher) return resposta(403);
    if (request.method === "DELETE" && area !== "uploads") return resposta(405);
    if (!["GET", "HEAD", "PUT", "DELETE"].includes(request.method)) return resposta(405);
    try {
      if (request.method === "PUT") {
        const limite = area === "releases" || area === "backups" ? 32 * 1024 * 1024 : 12 * 1024 * 1024;
        const textoTamanho = request.headers.get("content-length");
        if (!/^\d+$/.test(textoTamanho ?? "")) return resposta(411);
        const tamanho = Number(textoTamanho);
        if (!Number.isSafeInteger(tamanho) || tamanho < 1 || tamanho > limite) return resposta(413);
        const sha256 = request.headers.get("x-content-sha256");
        if (!/^[a-f0-9]{64}$/.test(sha256 ?? "")) return resposta(400);
        const imutavel = area === "releases" || area === "backups";
        const criarAusente = area === "uploads" && request.headers.get("if-none-match") === "*";
        if (imutavel) {
          const anterior = await bucket.head(chave);
          if (anterior) return resposta(anterior.customMetadata?.sha256 === sha256 && anterior.size === tamanho ? 204 : 409);
        }
        const gravado = await bucket.put(chave, request.body, {
          httpMetadata: { contentType: request.headers.get("content-type") ?? "application/octet-stream" },
          customMetadata: { sha256 },
          ...(imutavel || criarAusente ? { onlyIf: { etagDoesNotMatch: "*" } } : {}),
        });
        return resposta(gravado ? 204 : 409);
      }
      const objeto = request.method === "GET" ? await bucket.get(chave) : await bucket.head(chave);
      const capacidade = area === "uploads" ? { "x-lojas-create-only": "1" } : {};
      if (!objeto) return resposta(404, capacidade);
      if (request.method === "DELETE") { await bucket.delete(chave); return resposta(204); }
      return new Response(request.method === "HEAD" ? null : objeto.body, { headers: {
        "content-type": objeto.httpMetadata?.contentType ?? "application/octet-stream",
        "content-length": String(objeto.size), "cache-control": "no-store", "x-content-type-options": "nosniff",
        ...capacidade,
        ...(objeto.httpEtag ? { etag: objeto.httpEtag } : {}),
        ...(objeto.customMetadata?.sha256 ? { "x-content-sha256": objeto.customMetadata.sha256 } : {}),
      } });
    } catch { return resposta(503); }
  },
};
