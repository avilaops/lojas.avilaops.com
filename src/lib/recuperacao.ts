import { createHmac, timingSafeEqual } from "node:crypto";
import type { Tenant } from "@prisma/client";

/**
 * O link de "escolher senha nova", sem tabela:
 *
 * O token assina slug + validade + um pedaço do hash atual: usar uma vez
 * troca o hash e o mesmo token deixa de valer. Mora aqui, e não na rota, porque
 * duas portas mandam este link — "esqueci a senha" e o cadastro de quem já tem
 * conta (src/app/api/painel/cadastro).
 */
const BASE = process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com";
const VALIDADE_MS = 3_600_000;

function assinar(corpo: string) {
  return createHmac("sha256", Buffer.from(process.env.LOJAS_SECRET ?? "", "hex")).update(`recuperar:${corpo}`).digest("base64url");
}

function pedacoDoHash(senhaHash: string | null) {
  return (senhaHash ?? "").slice(-12);
}

export function tokenDeRecuperacao(slug: string, senhaHash: string | null, agora = Date.now()) {
  const corpo = Buffer.from(JSON.stringify({ slug, exp: agora + VALIDADE_MS, h: pedacoDoHash(senhaHash) })).toString("base64url");
  return `${corpo}.${assinar(corpo)}`;
}

export function linkDeRecuperacao(t: Pick<Tenant, "slug" | "senhaHash">) {
  return `https://${BASE}/redefinir?token=${encodeURIComponent(tokenDeRecuperacao(t.slug, t.senhaHash))}`;
}

export type LeituraDaRecuperacao = { slug: string; h: string } | { erro: "invalido" | "expirado" };

export function lerTokenDeRecuperacao(token: string, agora = Date.now()): LeituraDaRecuperacao {
  const [dados, assinatura] = token.split(".");
  if (!dados || !assinatura) return { erro: "invalido" };
  const esperada = assinar(dados);
  if (esperada.length !== assinatura.length || !timingSafeEqual(Buffer.from(esperada), Buffer.from(assinatura))) return { erro: "invalido" };
  try {
    const t = JSON.parse(Buffer.from(dados, "base64url").toString("utf8")) as { slug: string; exp: number; h: string };
    return t.exp < agora ? { erro: "expirado" } : { slug: t.slug, h: t.h };
  } catch {
    return { erro: "invalido" };
  }
}

/** O token ainda vale para esta loja? Deixa de valer quando a senha muda. */
export function tokenAindaValePara(t: Pick<Tenant, "senhaHash">, h: string) {
  return pedacoDoHash(t.senhaHash) === h;
}
