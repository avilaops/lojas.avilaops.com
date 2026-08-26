import { cache } from "react";
import { headers } from "next/headers";
import type { Tenant } from "@prisma/client";
import { prisma } from "./db";
import { lerTema, type TemaLoja } from "./tema";
import { lerIdentidade, type IdentidadeLoja } from "./identidade";

/**
 * Resolução da loja pelo Host.
 *
 * Dois caminhos:
 *   1. <slug>.LOJAS_BASE_DOMAIN → sempre funciona, desde o segundo em que a
 *      loja é criada (é o endereço de aprovação, antes do domínio próprio).
 *   2. domínio próprio (`Tenant.dominios`) → depois que o DNS aponta para cá.
 *
 * Sem cache entre requisições, de propósito. Já teve um `Map` com TTL de 60 s
 * aqui e ele criava um bug difícil de enxergar: no build standalone, a rota de
 * API e a página são bundles diferentes, cada um com sua instância do módulo —
 * a API limpava o cache dela e a página seguia servindo o valor velho. O
 * lojista salvava cor, layout ou pixel e a loja não mudava.
 *
 * O `cache()` do React já deduplica a consulta dentro da mesma requisição, e o
 * Postgres está no mesmo host: é um SELECT por requisição, com índice único.
 */

const BASE = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();

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

  const slug = slugDoHost(host);
  return slug
    ? prisma.tenant.findUnique({ where: { slug } })
    : prisma.tenant.findFirst({ where: { dominios: { has: host } } });
}

/**
 * Mantida por compatibilidade com quem chamava depois de salvar (provisionar,
 * assinatura, painel). Hoje não há cache para limpar — a função existe para
 * esses pontos continuarem legíveis e para o dia em que houver um cache
 * compartilhado de verdade (Redis ou revalidateTag).
 */
export function esquecerTenantEmCache(_slug: string) {
  void _slug;
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

export function identidadeDa(t: Tenant): IdentidadeLoja {
  return lerIdentidade(t.identidade);
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
    estoqueBaixoEm: t.estoqueBaixoEm,
    freteGratisAcima: t.freteGratisAcima,
    avisoTopo: t.avisoTopo,
    vende: lojaVende(t),
  };
}

export type TenantPublico = ReturnType<typeof tenantPublico>;
