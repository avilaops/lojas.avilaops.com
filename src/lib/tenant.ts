import { cache } from "react";
import { headers } from "next/headers";
import type { Tenant } from "@prisma/client";
import { prisma } from "./db";
import { lerTema, type TemaLoja } from "./tema";
import { lerIdentidade, type IdentidadeLoja } from "./identidade";
import { retiradaPublicaDisponivel } from "./retirada-publica";
export { retiradaPublicaDisponivel } from "./retirada-publica";

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

/**
 * CEP guardado é só dígito (o schema limpa na entrada). Na vitrine ele aparece
 * do jeito que o brasileiro lê: "01001-000", e não "01001000".
 */
export function formatarCep(cep?: string): string {
  const d = (cep ?? "").replace(/\D/g, "");
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : (cep ?? "");
}

// Moram em textos-loja.ts, sem next/headers, porque as políticas também são
// montadas na tela do painel, que roda no navegador.
export { prazoDeDespacho, porOndeFalarCom } from "./textos-loja";

/**
 * A marca da loja em quadrado sólido, para usar sobre fundo colorido.
 *
 * O logo em si não serve: ele é arte com fundo transparente, desenhada para
 * papel branco. Sobre a cor primária da loja ele pode sumir — na Vedashow o
 * wordmark é `#2c2c79` e a primária é quase a mesma, então a imagem de
 * compartilhamento saía com o logo invisível e o nome escrito do lado, isto
 * é, a marca duplicada com uma das cópias quebrada.
 *
 * O `apple-touch-icon.png` do favicon resolve porque ele **é** um ladrilho:
 * fundo sólido por especificação da Apple, margem já embutida, desenhado para
 * ser lido pequeno e sobre qualquer coisa. Mesma pasta e mesma convenção de
 * nomes que `iconesDa` usa em `layout.tsx`.
 */
export function marcaQuadradaDa(t: Tenant): string | null {
  if (t.faviconUrl) return `${t.faviconUrl.replace(/\/+$/, "")}/apple-touch-icon.png`;
  return t.logoUrl ?? null;
}

/** A loja tem ao menos um jeito de ser contatada? Se não, `/contato` mente. */
export function contatoConfigurado(t: Tenant): boolean {
  return Boolean(t.whatsapp || t.telefone || t.emailContato || t.enderecoPublico);
}

export function enderecoCompleto(t: Tenant): string {
  const e = enderecoDo(t);
  return [e.logradouro && `${e.logradouro}${e.numero ? ", " + e.numero : ""}`, e.bairro, e.cidade && `${e.cidade}${e.uf ? " - " + e.uf : ""}`, formatarCep(e.cep)]
    .filter(Boolean)
    .join(" · ");
}

export function temaDo(t: Tenant): TemaLoja {
  return lerTema(t.tema);
}

export function identidadeDa(t: Tenant): IdentidadeLoja {
  return lerIdentidade(t.identidade);
}

/**
 * A loja está sendo servida no endereço oficial dela?
 *
 * Uma loja com domínio próprio continua respondendo em
 * `<slug>.lojas.avilaops.com`, e ali ela é conteúdo duplicado do domínio de
 * verdade. O canonical já aponta para o certo, mas canonical é sugestão: o
 * Google pode indexar o subdomínio assim mesmo, e aí o endereço da marca passa
 * a competir com um subdomínio nosso pela mesma busca.
 *
 * Quem não tem domínio próprio é servida no subdomínio por definição, e ali o
 * subdomínio É o endereço oficial.
 */
export function noEnderecoOficial(t: Tenant, hostBruto: string | null): boolean {
  if (!t.dominioPrincipal) return true;
  const host = normalizarHost(hostBruto);
  const oficial = normalizarHost(t.dominioPrincipal);
  return host === oficial || host === `www.${oficial}`;
}

export function urlDaLoja(t: Tenant): string {
  const host = t.dominioPrincipal ?? `${t.slug}.${BASE}`;
  return `https://${host}`;
}

/**
 * A loja pode fechar venda pela própria tela?
 *
 * Três condições, e a terceira faltava: **sem credencial de pagamento salva não
 * existe checkout**. Antes, uma loja ATIVA no plano Loja mostrava "Finalizar
 * compra", o comprador preenchia endereço e frete e só então recebia
 * "pagamento ainda não configurado". Quem paga esse vexame é o lojista, na
 * frente do cliente dele.
 *
 * Quando isto é falso a vitrine continua inteira e o pedido vai pelo WhatsApp,
 * que é exatamente o que uma loja-demo deve fazer.
 */
export function lojaVende(t: Tenant): boolean {
  return t.status === "ATIVA" && t.plano !== "SITE" && Boolean(t.mpAccessTokenEnc);
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
    retiradaNaLoja: retiradaPublicaDisponivel(t),
    despachoDiasUteis: t.despachoDiasUteis,
    estoqueBaixoEm: t.estoqueBaixoEm,
    freteGratisAcima: t.freteGratisAcima,
    pedidoMinimoCentavos: t.pedidoMinimoCentavos,
    avisoTopo: t.avisoTopo,
    segmento: t.segmento,
    vende: lojaVende(t),
  };
}

export type TenantPublico = ReturnType<typeof tenantPublico>;
