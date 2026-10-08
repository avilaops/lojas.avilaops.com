import { createHash, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import manifesto from "../../gapp.json";

/**
 * O contrato do Padrão Oficial v1.
 *
 * A aplicação se entrega por um caminho só: um manifesto e cinco rotas fixas
 * em /v1. O plano de controle nunca entra aqui, não abre banco e não usa ssh:
 * ele sonda `/v1/health`, lê o manifesto pelo checksum e recebe o que a app
 * empurra. Ver docs/lojas-no-padrao-v1.md.
 *
 * O manifesto é importado, não lido do disco, para que `/v1/manifest` devolva
 * exatamente o arquivo que está no repositório: checksum que diverge do
 * registrado é o mesmo que não ter manifesto.
 */
export const MANIFESTO = manifesto;

/** Bytes canônicos do manifesto: é sobre eles que o checksum é calculado. */
const CORPO = JSON.stringify(manifesto);

export const CHECKSUM = createHash("sha256").update(CORPO).digest("hex");

const BASE = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();

/**
 * O contrato pertence à plataforma, não à loja do lojista.
 *
 * Sem isto, `<loja>.lojas.avilaops.com/v1/health` responderia por uma app
 * que não é dele, e o coletor poderia julgar a plataforma inteira pela vitrine
 * de um cliente.
 */
export async function noDominioDaPlataforma(): Promise<boolean> {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "").toLowerCase().replace(/:\d+$/, "");
  return host === BASE;
}

/** 404 do contrato: qualquer coisa sob /v1 que não seja rota declarada. */
export function naoEncontrado(): Response {
  return Response.json({ erro: "not_found" }, { status: 404 });
}

/**
 * Bearer do harness, comparado em tempo constante.
 *
 * Sem token configurado a rota responde 503, e não 200 vazio: o plano de
 * controle precisa distinguir "app sem harness" de "app que respondeu".
 */
export function autorizado(request: Request): { ok: true } | { ok: false; resposta: Response } {
  const esperado = process.env.GAPP_HARNESS_TOKEN ?? "";
  if (!esperado) {
    return { ok: false, resposta: Response.json({ erro: "harness_nao_configurado" }, { status: 503 }) };
  }

  const cabecalho = request.headers.get("authorization") ?? "";
  const recebido = cabecalho.startsWith("Bearer ") ? cabecalho.slice(7) : "";
  const a = Buffer.from(esperado);
  const b = Buffer.from(recebido);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return { ok: false, resposta: Response.json({ erro: "nao_autorizado" }, { status: 401 }) };
  }

  return { ok: true };
}

/** Cabeçalhos comuns: nada do contrato pode ser servido de cache. */
export const SEM_CACHE = { "cache-control": "no-store" } as const;
