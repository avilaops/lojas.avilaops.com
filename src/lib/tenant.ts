import { cache } from "react";
import { headers } from "next/headers";
import type { Tenant } from "@prisma/client";
import { prisma } from "./db";
import { lerTema, type TemaLoja } from "./tema";

/**
 * Resolução da loja pelo Host.
 *
 * Dois caminhos:
 *   1. <slug>.LOJAS_BASE_DOMAIN → sempre funciona, desde o segundo em que a
 *      loja é criada (é o endereço de aprovação, antes do domínio próprio).
 *   2. domínio próprio (`Tenant.dominios`) → depois que o DNS aponta para cá.
 *
 * Cache curto em memória por processo: a vitrine recebe centenas de requisições
 * por minuto e o tenant muda uma vez por semana. 60 s de atraso numa troca de
 * cor é aceitável; um SELECT por requisição não.
 */

const BASE = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();
const TTL_MS = 60_000;
const memoria = new Map<string, { tenant: Tenant | null; expira: number }>();

export function normalizarHost(host: string | null): string {
  return (host ?? "").toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

export function slugDoHost(host: string): string | null {
  if (host.endsWith(`.${BASE}`)) {
    const slug = host.slice(0, -(BASE.length + 1));
    return slug.includes(".") ? null : slug;
  }
  return null;
}

export async function buscarTenantPorHost(hostBruto: string | null): Promise<Tenant | null> {
  const host = normalizarHost(hostBruto);
  if (!host) return null;

  const emCache = memoria.get(host);
  if (emCache && emCache.expira > Date.now()) return emCache.tenant;

  const slug = slugDoHost(host);
  const tenant = slug
    ? await prisma.tenant.findUnique({ where: { slug } })
    : await prisma.tenant.findFirst({ where: { dominios: { has: host } } });

  memoria.set(host, { tenant, expira: Date.now() + TTL_MS });
  return tenant;
}

export function esquecerTenantEmCache(slug: string) {
  for (const [host, v] of memoria) if (v.tenant?.slug === slug) memoria.delete(host);
}

/** Tenant da requisição atual (server components e route handlers). */
export const tenantAtual = cache(async (): Promise<Tenant | null> => {
  const h = await headers();
  return buscarTenantPorHost(h.get("x-forwarded-host") ?? h.get("host"));
});

export class LojaNaoEncontrada extends Error {}

export async function exigirTenant(): Promise<Tenant> {
  const t = await tenantAtual();
  if (!t) throw new LojaNaoEncontrada("Nenhuma loja responde por este endereço.");
  return t;
}

// ── Projeções ──────────────────────────────────────────────────────────

export interface Endereco {
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
}

export function enderecoDo(t: Tenant): Endereco {
  return (t.endereco as Endereco | null) ?? {};
}

export function enderecoCompleto(t: Tenant): string {
  const e = enderecoDo(t);
  return [e.logradouro && `${e.logradouro}${e.numero ? ", " + e.numero : ""}`, e.bairro, e.cidade && `${e.cidade}${e.uf ? " - " + e.uf : ""}`, e.cep]
    .filter(Boolean)
    .join(" · ");
}

export function temaDo(t: Tenant): TemaLoja {
  return lerTema(t.tema);
}

export function urlDaLoja(t: Tenant): string {
  const host = t.dominioPrincipal ?? `${t.slug}.${BASE}`;
  return `https://${host}`;
}

export function lojaVende(t: Tenant): boolean {
  return t.status === "ATIVA" && t.plano !== "SITE";
}

/** O que o navegador pode saber da loja. Nunca inclui token cifrado. */
export function tenantPublico(t: Tenant) {
  return {
    slug: t.slug,
    nome: t.nome,
    plano: t.plano,
    status: t.status,
    whatsapp: t.whatsapp,
    mpPublicKey: t.mpPublicKey,
    meiosPagamento: t.meiosPagamento,
    retiradaNaLoja: t.retiradaNaLoja,
    despachoDiasUteis: t.despachoDiasUteis,
    freteGratisAcima: t.freteGratisAcima,
    vende: lojaVende(t),
  };
}

export type TenantPublico = ReturnType<typeof tenantPublico>;
