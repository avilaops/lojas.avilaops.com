import { randomBytes } from "node:crypto";
import type { CredencialPagamento, Pedido, Prisma, Tenant } from "@prisma/client";
import { ehProvedor, type ContextoProvedor, type PaymentProvider, type ProvedorId, type ResultadoTesteConexao, type StatusCredencial } from "@avilaops/checkout/server";
import { cifrar, decifrar } from "./cofre";
import { prisma } from "./db";
import { GatewayNaoConfigurado, providerDaLoja } from "./gateway";
import { providerDoPixManual } from "./pix-manual";
import { conectadoPorOAuth } from "./mercado-pago-conta";
import { provedoresDePagamento } from "./provedores-pagamento";

/**
 * Credenciais de pagamento por loja (`CredencialPagamento`).
 *
 * Uma por provedor por loja; uma delas é a padrão (`Tenant.credencialPadraoId`)
 * e é com ela que a loja cobra. O pedido guarda a credencial que o cobrou
 * (`Pedido.credencialId`), e webhook e conciliação usam essa.
 *
 * Mercado Pago "legado" (`segredosEnc` nulo): os segredos continuam nas
 * colunas mp* do Tenant, que o OAuth e a renovação escrevem. O provedor é
 * montado por `providerDaLoja`, exatamente como antes desta tabela.
 */

const BASE_PLATAFORMA = () => process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com";

export function novoTokenDeWebhook(): string {
  return randomBytes(24).toString("hex");
}

/** URL do webhook genérico desta credencial. */
export function urlDoWebhook(c: Pick<CredencialPagamento, "provedor" | "webhookToken">): string {
  return `https://${BASE_PLATAFORMA()}/api/webhooks/pagamentos/${c.provedor}/${c.webhookToken}`;
}

export function ehLegadoMercadoPago(c: Pick<CredencialPagamento, "provedor" | "segredosEnc">): boolean {
  return c.provedor === "mercadopago" && c.segredosEnc === null;
}

export function cifrarSegredos(segredos: Record<string, string | undefined>): string {
  const limpos = Object.fromEntries(Object.entries(segredos).filter(([, v]) => typeof v === "string" && v.length > 0));
  return cifrar(JSON.stringify(limpos));
}

export function decifrarSegredos(enc: string | null): Record<string, string> {
  if (!enc) return {};
  const d = JSON.parse(decifrar(enc)) as unknown;
  return d && typeof d === "object" ? (d as Record<string, string>) : {};
}

function publicosDe(c: Pick<CredencialPagamento, "publicos">): Record<string, string | undefined> {
  const p = c.publicos;
  return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, string | undefined>) : {};
}

function descritor(t: Pick<Tenant, "nome">): string {
  return t.nome.replace(/[^A-Za-z0-9 ]/g, "").toUpperCase().slice(0, 13);
}

export function contextoDaCredencial(t: Tenant, c: CredencialPagamento): ContextoProvedor {
  if (ehLegadoMercadoPago(c) && t.mpAccessTokenEnc) {
    return { segredos: { accessToken: decifrar(t.mpAccessTokenEnc) }, publicos: publicosDe(c), notificationUrl: urlDoWebhook(c), descritorFatura: descritor(t) };
  }
  return { segredos: decifrarSegredos(c.segredosEnc), publicos: publicosDe(c), notificationUrl: urlDoWebhook(c), descritorFatura: descritor(t) };
}

/** Monta o provedor de uma credencial. Lança GatewayNaoConfigurado se não der. */
export function providerDaCredencial(t: Tenant, c: CredencialPagamento): PaymentProvider {
  if (ehLegadoMercadoPago(c)) return providerDaLoja(t);
  if (!ehProvedor(c.provedor) || !provedoresDePagamento.tem(c.provedor)) {
    throw new GatewayNaoConfigurado(`Provedor ${c.provedor} não disponível nesta versão.`);
  }
  try {
    const ctx = contextoDaCredencial(t, c);
    if (c.provedor === "pix_manual") return providerDoPixManual(t, ctx);
    return provedoresDePagamento.obter(c.provedor).criar(ctx);
  } catch (erro) {
    throw new GatewayNaoConfigurado(erro instanceof Error ? erro.message : String(erro));
  }
}

/**
 * A credencial do Mercado Pago "legado" desta loja, criada se faltar. Para a
 * loja que conectou o MP depois do backfill: a coluna mp* existe, a linha não.
 */
export async function garantirCredencialMercadoPago(t: Tenant): Promise<CredencialPagamento | null> {
  if (!t.mpAccessTokenEnc) return null;
  const c = await prisma.credencialPagamento.upsert({
    where: { tenantId_provedor: { tenantId: t.id, provedor: "mercadopago" } },
    update: {},
    create: {
      tenantId: t.id,
      provedor: "mercadopago",
      tipoConexao: conectadoPorOAuth(t) ? "oauth" : "chave",
      status: "conectado",
      publicos: t.mpPublicKey ? { publicKey: t.mpPublicKey } : {},
      webhookToken: novoTokenDeWebhook(),
      conta: t.mpConta,
    },
  });
  if (!t.credencialPadraoId) {
    await prisma.tenant.updateMany({ where: { id: t.id, credencialPadraoId: null }, data: { credencialPadraoId: c.id, provedorPadrao: "mercadopago" } });
  }
  return c;
}

export type Recebimento = { provider: PaymentProvider; credencial: CredencialPagamento | null };

/**
 * Com o que esta loja cobra agora. Loja sem padrão e com MP nas colunas mp*
 * ganha a credencial legado na hora; o provedor é o mesmo de antes.
 */
export async function resolverRecebimento(t: Tenant): Promise<Recebimento> {
  if (t.credencialPadraoId) {
    const c = await prisma.credencialPagamento.findUnique({ where: { id: t.credencialPadraoId } });
    if (c) return { provider: providerDaCredencial(t, c), credencial: c };
  }
  if (t.mpAccessTokenEnc) {
    const c = await garantirCredencialMercadoPago(t).catch(() => null);
    return { provider: providerDaLoja(t), credencial: c };
  }
  throw new GatewayNaoConfigurado(`A loja ${t.slug} ainda não tem gateway de pagamento configurado.`);
}

/** O provedor que cobrou este pedido; sem credencial gravada, o de antes. */
export async function providerDoPedido(t: Tenant, p: Pick<Pedido, "credencialId">): Promise<PaymentProvider> {
  if (p.credencialId) {
    const c = await prisma.credencialPagamento.findUnique({ where: { id: p.credencialId } });
    if (c && c.tenantId === t.id) return providerDaCredencial(t, c);
  }
  return providerDaLoja(t);
}

/** Salva (ou troca) a credencial de um provedor, já testada. Segredos cifrados. */
export async function salvarCredencial(
  t: Tenant,
  provedor: ProvedorId,
  dados: { segredos: Record<string, string | undefined>; publicos: Record<string, string | undefined> },
  teste: ResultadoTesteConexao,
): Promise<CredencialPagamento> {
  const def = provedoresDePagamento.obter(provedor);
  const status: StatusCredencial = teste.ok ? "conectado" : "erro";
  const comum = {
    tipoConexao: def.tipoConexao,
    status,
    mensagem: teste.mensagem,
    segredosEnc: cifrarSegredos(dados.segredos),
    publicos: dados.publicos as Prisma.InputJsonValue,
    conta: teste.ok ? (teste.conta ?? null) : null,
    testadoEm: new Date(),
  };
  return prisma.credencialPagamento.upsert({
    where: { tenantId_provedor: { tenantId: t.id, provedor } },
    update: comum,
    create: { tenantId: t.id, provedor, webhookToken: novoTokenDeWebhook(), ...comum },
  });
}

export class PadraoRecusado extends Error {}

/** Só credencial conectada vira padrão: a loja não pode passar a cobrar com uma que falha. */
export async function definirPadrao(t: Tenant, credencialId: string): Promise<void> {
  const c = await prisma.credencialPagamento.findUnique({ where: { id: credencialId } });
  if (!c || c.tenantId !== t.id) throw new PadraoRecusado("Conta de recebimento não encontrada.");
  if (c.status !== "conectado") throw new PadraoRecusado("Teste a conexão e deixe a conta como Conectado antes de usar como padrão.");
  await prisma.tenant.update({ where: { id: t.id }, data: { credencialPadraoId: c.id, provedorPadrao: c.provedor } });
}

/** O que a tela mostra de cada credencial. Nunca inclui segredo. */
export function credencialParaTela(c: CredencialPagamento, padraoId: string | null) {
  return {
    id: c.id,
    provedor: c.provedor,
    tipoConexao: c.tipoConexao,
    status: c.status as StatusCredencial,
    mensagem: c.mensagem,
    conta: c.conta,
    publicos: publicosDe(c),
    padrao: c.id === padraoId,
    testadoEm: c.testadoEm?.toISOString() ?? null,
  };
}
