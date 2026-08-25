import type { Plano, Tenant } from "@prisma/client";
import { prisma } from "./db";
import { emitir } from "./eventos";
import { esquecerTenantEmCache } from "./tenant";
import { alterarPreapproval, buscarPagamentoAutorizado, buscarPreapproval, criarPreapproval } from "./mercadopago-assinatura";

/**
 * Mensalidade da loja.
 *
 * Preço por plano (centavos). O setup (R$ 497) é cobrado à parte, no
 * fechamento comercial, e marcado em `setupPagoEm` pela API admin.
 *
 * Ciclo: SEM_ASSINATURA → (lojista clica "Ativar cobrança") PENDENTE, com
 * init_point para cadastrar o cartão → webhook `subscription_preapproval`
 * traz AUTORIZADA → cada mês `subscription_authorized_payment` vira Fatura.
 * Recusa: o MP tenta de novo por dias; só depois de DIAS_TOLERANCIA sem
 * pagamento a loja fica SUSPENSA (vitrine no ar, checkout some). Pagou de
 * novo → ATIVA na hora.
 */
export const PRECO_PLANO: Record<Plano, number> = { SITE: 7900, LOJA: 11900, LOJA_PRO: 34900 };
export const NOME_PLANO: Record<Plano, string> = { SITE: "Site", LOJA: "Loja", LOJA_PRO: "Loja Pro" };
const DIAS_TOLERANCIA = Number(process.env.LOJAS_DIAS_TOLERANCIA ?? 7);
const BASE = process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com";

const STATUS_MP: Record<string, string> = { pending: "PENDENTE", authorized: "AUTORIZADA", paused: "PAUSADA", cancelled: "CANCELADA" };

export async function iniciarAssinatura(t: Tenant): Promise<{ status: string; initPoint: string | null }> {
  if (t.assinaturaStatus === "AUTORIZADA") return { status: "AUTORIZADA", initPoint: null };
  if (t.assinaturaId && t.assinaturaStatus === "PENDENTE" && t.assinaturaInitPoint) {
    // Já existe uma pendente: reaproveita o link em vez de criar outra no MP.
    return { status: "PENDENTE", initPoint: t.assinaturaInitPoint };
  }
  if (!t.loginEmail) throw new Error("A loja precisa de um e-mail de login para assinar.");

  const pre = await criarPreapproval({
    motivo: `Avila Ops · Loja ${t.nome} · plano ${NOME_PLANO[t.plano]}`,
    slug: t.slug,
    payerEmail: t.loginEmail,
    valorCentavos: PRECO_PLANO[t.plano],
    backUrl: `https://${BASE}/painel?assinatura=voltou`,
  });
  await prisma.tenant.update({
    where: { id: t.id },
    data: { assinaturaId: pre.id, assinaturaStatus: STATUS_MP[pre.status] ?? "PENDENTE", assinaturaInitPoint: pre.init_point ?? null },
  });
  return { status: STATUS_MP[pre.status] ?? "PENDENTE", initPoint: pre.init_point ?? null };
}

export async function cancelarAssinatura(t: Tenant) {
  if (t.assinaturaId) await alterarPreapproval(t.assinaturaId, "cancelled").catch((e) => console.error("[assinatura] cancelar no MP:", e));
  await prisma.tenant.update({ where: { id: t.id }, data: { assinaturaStatus: "CANCELADA", assinaturaInitPoint: null } });
}

async function suspender(t: Tenant, motivo: string) {
  if (t.status === "SUSPENSA" || t.status === "CANCELADA") return;
  await prisma.tenant.update({ where: { id: t.id }, data: { status: "SUSPENSA", suspensaEm: new Date() } });
  esquecerTenantEmCache(t.slug);
  await emitir({ tipo: "loja.suspensa", slug: t.slug, nome: t.nome, motivo, emailContato: t.loginEmail ?? t.emailContato, whatsapp: t.whatsapp });
}

async function reativar(t: Tenant) {
  if (t.status !== "SUSPENSA") return;
  await prisma.tenant.update({ where: { id: t.id }, data: { status: "ATIVA", suspensaEm: null } });
  esquecerTenantEmCache(t.slug);
  await emitir({ tipo: "loja.reativada", slug: t.slug, nome: t.nome, emailContato: t.loginEmail ?? t.emailContato, whatsapp: t.whatsapp });
}

// ── Webhook ────────────────────────────────────────────────────────────

export interface Notificacao { topico: string; dataId: string }

/** Idempotente: a notificação é registrada antes de ser processada. */
export async function processarNotificacao(n: Notificacao): Promise<{ processada: boolean; motivo: string }> {
  const chave = `${n.topico}:${n.dataId}`;
  const vista = await prisma.cobrancaEvento.findUnique({ where: { notificacaoId: chave } });
  if (vista?.processadoEm) return { processada: false, motivo: "repetida" };
  const evento = vista ?? (await prisma.cobrancaEvento.create({ data: { notificacaoId: chave, topico: n.topico } }));

  try {
    const r = n.topico === "subscription_preapproval" ? await sincronizarPreapproval(n.dataId)
      : n.topico === "subscription_authorized_payment" ? await registrarCobranca(n.dataId)
      : { motivo: `tópico ignorado: ${n.topico}` as string, tenantId: undefined as string | undefined };
    await prisma.cobrancaEvento.update({ where: { id: evento.id }, data: { processadoEm: new Date(), tenantId: r.tenantId ?? null } });
    return { processada: true, motivo: r.motivo };
  } catch (erro) {
    await prisma.cobrancaEvento.update({ where: { id: evento.id }, data: { erro: String(erro instanceof Error ? erro.message : erro).slice(0, 2000) } });
    throw erro;
  }
}

async function sincronizarPreapproval(id: string) {
  const pre = await buscarPreapproval(id);
  const t = await prisma.tenant.findFirst({ where: { OR: [{ assinaturaId: id }, { slug: pre.external_reference ?? "___" }] } });
  if (!t) return { motivo: "assinatura sem loja" };
  const status = STATUS_MP[pre.status] ?? "PENDENTE";
  await prisma.tenant.update({ where: { id: t.id }, data: { assinaturaId: id, assinaturaStatus: status, ...(status === "AUTORIZADA" ? { assinaturaInitPoint: null } : {}) } });
  if (status === "CANCELADA" || status === "PAUSADA") await suspender(t, `assinatura ${status.toLowerCase()} no Mercado Pago`);
  else if (status === "AUTORIZADA") await reativar(t);
  return { motivo: `assinatura ${status}`, tenantId: t.id };
}

async function registrarCobranca(id: string) {
  const c = await buscarPagamentoAutorizado(id);
  const t = await prisma.tenant.findFirst({ where: { assinaturaId: c.preapproval_id } });
  if (!t) return { motivo: "cobrança sem loja" };
  const aprovada = c.status === "processed" || c.payment?.status === "approved";
  const centavos = Math.round((c.transaction_amount ?? 0) * 100);
  await prisma.fatura.upsert({
    where: { externalId: String(c.id) },
    create: { tenantId: t.id, externalId: String(c.id), centavos, status: aprovada ? "approved" : (c.payment?.status ?? c.status), detalhe: c.payment?.status_detail ?? null, pagaEm: aprovada ? new Date() : null },
    update: { status: aprovada ? "approved" : (c.payment?.status ?? c.status), detalhe: c.payment?.status_detail ?? null, pagaEm: aprovada ? new Date() : null },
  });
  if (aprovada) {
    await prisma.tenant.update({ where: { id: t.id }, data: { ultimoPagamentoEm: new Date(), tentativasFalhas: 0 } });
    await reativar(t);
    await emitir({ tipo: "loja.mensalidade-paga", slug: t.slug, nome: t.nome, centavos, emailContato: t.loginEmail ?? t.emailContato, whatsapp: t.whatsapp });
    return { motivo: "mensalidade paga", tenantId: t.id };
  }
  const tentativas = t.tentativasFalhas + 1;
  await prisma.tenant.update({ where: { id: t.id }, data: { tentativasFalhas: tentativas } });
  const referencia = t.ultimoPagamentoEm ?? t.criadoEm;
  const dias = (Date.now() - referencia.getTime()) / 86_400_000;
  if (dias > 30 + DIAS_TOLERANCIA) {
    await suspender(t, `mensalidade recusada ${tentativas}x, tolerância de ${DIAS_TOLERANCIA} dias vencida`);
    return { motivo: "recusada, loja suspensa", tenantId: t.id };
  }
  await emitir({ tipo: "loja.mensalidade-recusada", slug: t.slug, nome: t.nome, tentativas, emailContato: t.loginEmail ?? t.emailContato, whatsapp: t.whatsapp });
  return { motivo: `recusada (${tentativas}ª), dentro da tolerância`, tenantId: t.id };
}

// ── Verificação diária (cron via n8n → POST /api/admin/cobranca/verificar) ──

/**
 * Suspende lojas ATIVAS cuja assinatura não está autorizada há mais de
 * DIAS_TOLERANCIA depois do período de teste, e as que ficaram > 30 +
 * tolerância sem pagamento. Lojas sem assinatura têm 14 dias de teste.
 */
export async function verificarInadimplencia(): Promise<{ suspensas: string[] }> {
  const agora = Date.now();
  const lojas = await prisma.tenant.findMany({ where: { status: "ATIVA" } });
  const suspensas: string[] = [];
  for (const t of lojas) {
    if (t.plano === "SITE" && t.assinaturaStatus === "SEM_ASSINATURA") continue; // vitrine grátis enquanto não assina? não: mesma regra
    const diasDesdeCriacao = (agora - t.criadoEm.getTime()) / 86_400_000;
    const diasDesdePagamento = t.ultimoPagamentoEm ? (agora - t.ultimoPagamentoEm.getTime()) / 86_400_000 : null;
    let motivo: string | null = null;
    if (t.assinaturaStatus !== "AUTORIZADA" && diasDesdeCriacao > 14 + DIAS_TOLERANCIA && !t.setupPagoEm) motivo = "período de teste encerrado sem assinatura";
    else if (t.assinaturaStatus === "AUTORIZADA" && diasDesdePagamento !== null && diasDesdePagamento > 30 + DIAS_TOLERANCIA) motivo = "mais de um mês sem pagamento confirmado";
    if (motivo) {
      await suspender(t, motivo);
      suspensas.push(t.slug);
    }
  }
  return { suspensas };
}
