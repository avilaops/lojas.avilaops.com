import { tenantAtual } from "@/lib/tenant";
import { LimitadorPorJanela, cabecalhosDoLimite } from "@/lib/api-limite";
import { normalizarDemandaPk } from "@/lib/pk-demanda-busca";
import { registrarDemandaPk } from "@/lib/pk-demanda-consulta";

const limitador = new LimitadorPorJanela();
const semCache = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
  try {
    const origem = request.headers.get("origin");
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
    const protocolo = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
    if (!origem || new URL(origem).origin !== `${protocolo}://${host}` || request.headers.get("sec-fetch-site") === "cross-site") return new Response(null, { status: 403, headers: semCache });
    const tenant = await tenantAtual();
    if (!tenant || tenant.slug !== "pkvedacoes" || tenant.status !== "ATIVA") return new Response(null, { status: 404, headers: semCache });
    // IP usado somente como chave efêmera do limitador em memória; nunca é persistido.
    const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconhecido";
    const limite = limitador.consumir(`${tenant.id}:${ip}`, 15);
    const headers = { ...semCache, ...cabecalhosDoLimite(limite) };
    if (!limite.permitido) return new Response(null, { status: 429, headers });
    if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return new Response(null, { status: 415, headers });
    const leitor = request.body?.getReader();
    if (!leitor) return new Response(null, { status: 400, headers });
    const partes: Uint8Array[] = [];
    let bytes = 0;
    while (true) {
      const { done, value } = await leitor.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 512) { await leitor.cancel(); return new Response(null, { status: 413, headers }); }
      partes.push(value);
    }
    let entrada: unknown;
    try { entrada = JSON.parse(Buffer.concat(partes).toString("utf8")); } catch { return new Response(null, { status: 400, headers }); }
    if (!entrada || typeof entrada !== "object" || Array.isArray(entrada)) return new Response(null, { status: 422, headers });
    const dados = entrada as Record<string, unknown>;
    const demanda = normalizarDemandaPk(dados.consulta);
    if (dados.consentido !== true || !demanda || Object.keys(dados).some(k => !["consulta", "consentido"].includes(k))) return new Response(null, { status: 422, headers });
    await registrarDemandaPk(tenant, demanda.consulta);
    return new Response(null, { status: 204, headers });
  } catch { return new Response(null, { status: 503, headers: semCache }); }
}
