import { createHmac } from "node:crypto";
import type { Tenant } from "@prisma/client";
import { urlDaLoja } from "./tenant";

/**
 * Indexação garantida — o diferencial da plataforma.
 *
 * Toda loja é avisada aos buscadores sem o lojista fazer nada:
 *
 *   - **IndexNow** (Bing, Yandex, Naver, Seznam): protocolo de ping instantâneo.
 *     A chave é derivada do LOJAS_SECRET + slug, então é estável, não precisa de
 *     tabela e é servida em /indexnow-key.txt no domínio da própria loja.
 *   - **Google** não tem ping: lê o sitemap, que só lista o que vale página.
 *
 * Nada disso pode derrubar uma operação: falha vira log.
 */
const ENDPOINTS_INDEXNOW = ["https://api.indexnow.org/indexnow", "https://www.bing.com/indexnow"];

export function chaveIndexNow(slug: string): string {
  const segredo = process.env.LOJAS_SECRET ?? "lojas";
  // 32 hex: formato aceito pelo IndexNow (8–128 caracteres, hex).
  return createHmac("sha256", segredo).update(`indexnow:${slug}`).digest("hex").slice(0, 32);
}

/** O que os buscadores responderam a um aviso. */
export type ResultadoDoAviso = { enviado: boolean; aceitos: number; urls: number };

/** 2xx do IndexNow é "recebi"; 4xx é chave ou host recusado, e não conta como aviso. */
export function avisoAceito(respostas: Array<{ ok: boolean } | null>): number {
  return respostas.filter((r) => r?.ok).length;
}

/**
 * Avisa os buscadores sobre URLs que nasceram ou mudaram.
 *
 * Devolve quantos endpoints aceitaram. A tela dizia "buscadores avisados" a
 * partir de qualquer chamada que não desse erro de rede: um 403 de chave
 * recusada contava como aviso feito. Quem grava a data do aviso usa
 * `avisarERegistrar`, que só a grava com pelo menos um aceite.
 *
 * O ping de sitemap do Bing saiu: o endpoint responde 410 desde que o Bing o
 * descontinuou, como o Google já tinha feito com o dele.
 */
export async function avisarBuscadores(t: Tenant, caminhos: string[] = ["/"]): Promise<ResultadoDoAviso> {
  if (process.env.LOJAS_INDEXNOW_ENABLED === "false" || t.status !== "ATIVA") return { enviado: false, aceitos: 0, urls: 0 };
  const base = urlDaLoja(t);
  const host = base.replace(/^https?:\/\//, "");
  const urls = Array.from(new Set(caminhos.map((c) => `${base}${c.startsWith("/") ? c : `/${c}`}`))).slice(0, 10000);
  if (!urls.length) return { enviado: false, aceitos: 0, urls: 0 };
  const corpo = JSON.stringify({ host, key: chaveIndexNow(t.slug), keyLocation: `${base}/indexnow-key.txt`, urlList: urls });

  const respostas = await Promise.all(
    ENDPOINTS_INDEXNOW.map((url) =>
      fetch(url, { method: "POST", headers: { "content-type": "application/json; charset=utf-8" }, body: corpo, signal: AbortSignal.timeout(8000) })
        .then((r) => ({ ok: r.ok, status: r.status }))
        .catch(() => null),
    ),
  );
  const aceitos = avisoAceito(respostas);
  if (aceitos < respostas.length) {
    console.warn(`[indexnow] ${host}: ${aceitos}/${respostas.length} aceitaram (${respostas.map((r) => r?.status ?? "sem resposta").join(", ")})`);
  }
  return { enviado: true, aceitos, urls: urls.length };
}

/**
 * Avisa e, se algum buscador aceitou, grava a data em `Tenant.indexadoEm`.
 * É o que a aba Buscadores mostra como "avisados em".
 */
export async function avisarERegistrar(t: Tenant, caminhos: string[]): Promise<ResultadoDoAviso> {
  const r = await avisarBuscadores(t, caminhos);
  if (r.aceitos > 0) {
    const { prisma } = await import("./db");
    await prisma.tenant.update({ where: { id: t.id }, data: { indexadoEm: new Date() } }).catch(() => undefined);
  }
  return r;
}

/** Caminhos que valem avisar quando o catálogo muda. */
export function caminhosDoProduto(slug: string, categoriaSlug?: string | null): string[] {
  return ["/", "/produtos", `/produtos/${slug}`, ...(categoriaSlug ? [`/categoria/${categoriaSlug}`] : [])];
}
