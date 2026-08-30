import type { Plano, Tenant } from "@prisma/client";
import { prisma } from "./db";
import { emitir } from "./eventos";
import { esquecerTenantEmCache } from "./tenant";
import { alterarPreapproval, atualizarValorPreapproval, buscarCobrancasDaAssinatura, buscarPagamentoAutorizado, buscarPreapproval, criarPreapproval, type PagamentoAutorizado } from "./mercadopago-assinatura";

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
/** Onde o lojista resolve a cobrança. Vai junto do evento para o n8n não precisar montar URL. */
const LINK_ASSINATURA = `https://${BASE}/painel?aba=assinatura`;

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

/**
 * Pausa ou retoma a mensalidade no Mercado Pago e reflete no banco.
 *
 * Diferente do cancelamento, pausar é reversível: o cartão continua vinculado
 * e o MP volta a cobrar quando a assinatura for retomada. Serve para negociar
 * com um lojista sem perder o meio de pagamento dele.
 */
export async function mudarEstadoAssinatura(t: Tenant, estado: "paused" | "authorized") {
  if (!t.assinaturaId) throw new Error("Loja sem assinatura.");
  await alterarPreapproval(t.assinaturaId, estado);
  const status = estado === "paused" ? "PAUSADA" : "AUTORIZADA";
  await prisma.tenant.update({ where: { id: t.id }, data: { assinaturaStatus: status } });
  esquecerTenantEmCache(t.slug);
  // Pausar não derruba a loja sozinho: quem decide isso é a régua de
  // inadimplência. Retomar, sim, devolve o checkout na hora.
  if (estado === "authorized") await reativar(t);
}

/** Reajuste do valor mensal — é também o caminho de ligar e desligar adicional. */
export async function reajustarAssinatura(t: Tenant, centavos: number) {
  if (!t.assinaturaId) throw new Error("Loja sem assinatura.");
  await atualizarValorPreapproval(t.assinaturaId, centavos);
  esquecerTenantEmCache(t.slug);
}

export async function cancelarAssinatura(t: Tenant) {
  if (t.assinaturaId) await alterarPreapproval(t.assinaturaId, "cancelled").catch((e) => console.error("[assinatura] cancelar no MP:", e));
  await prisma.tenant.update({ where: { id: t.id }, data: { assinaturaStatus: "CANCELADA", assinaturaInitPoint: null } });
}

async function suspender(t: Tenant, motivo: string) {
  // A isenção mora aqui, no único ponto por onde toda suspensão passa. Ela
  // nasceu só dentro da rotina diária e a demo foi suspensa assim mesmo: o
  // caminho do webhook (assinatura cancelada no Mercado Pago) não conhecia a
  // regra. Guard no lugar errado é guard que um caminho novo esquece.
  if (t.cobrancaIsenta) return;
  if (t.status === "SUSPENSA" || t.status === "CANCELADA") return;
  await prisma.tenant.update({ where: { id: t.id }, data: { status: "SUSPENSA", suspensaEm: new Date() } });
  esquecerTenantEmCache(t.slug);
  await emitir({ tipo: "loja.suspensa", slug: t.slug, nome: t.nome, motivo, link: LINK_ASSINATURA, emailContato: t.loginEmail ?? t.emailContato, whatsapp: t.whatsapp });
}

async function reativar(t: Tenant) {
  if (t.status !== "SUSPENSA") return;
  await prisma.tenant.update({ where: { id: t.id }, data: { status: "ATIVA", suspensaEm: null } });
  esquecerTenantEmCache(t.slug);
  await emitir({ tipo: "loja.reativada", slug: t.slug, nome: t.nome, url: `https://${t.slug}.${BASE}`, emailContato: t.loginEmail ?? t.emailContato, whatsapp: t.whatsapp });
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

const registrarCobranca = async (id: string) => aplicarCobranca(await buscarPagamentoAutorizado(id));

/**
 * Registra uma cobrança da mensalidade, venha ela do webhook ou da varredura
 * diária.
 *
 * A varredura relê as mesmas cobranças todo dia, então o efeito colateral
 * (avisar o lojista, contar tentativa, suspender) só acontece quando o estado
 * muda de verdade — senão o lojista receberia o mesmo "mensalidade paga" toda
 * manhã e uma recusa antiga viraria dez tentativas.
 */
async function aplicarCobranca(c: PagamentoAutorizado) {
  const t = await prisma.tenant.findFirst({ where: { assinaturaId: c.preapproval_id } });
  if (!t) return { motivo: "cobrança sem loja" };
  const aprovada = c.status === "processed" || c.payment?.status === "approved";
  const centavos = Math.round((c.transaction_amount ?? 0) * 100);
  const situacao = aprovada ? "approved" : (c.payment?.status ?? c.status);
  const conhecida = await prisma.fatura.findUnique({ where: { externalId: String(c.id) } });

  await prisma.fatura.upsert({
    where: { externalId: String(c.id) },
    create: { tenantId: t.id, externalId: String(c.id), centavos, status: situacao, detalhe: c.payment?.status_detail ?? null, pagaEm: aprovada ? new Date() : null },
    update: { status: situacao, detalhe: c.payment?.status_detail ?? null, ...(aprovada && !conhecida?.pagaEm ? { pagaEm: new Date() } : {}) },
  });

  if (conhecida?.status === situacao) return { motivo: "cobrança já registrada", tenantId: t.id };

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
  // Quantos dias ainda restam antes da suspensão automática. A régua de
  // cobrança no n8n muda o tom conforme esse número — sem ele a mensagem
  // teria de falar em "em breve", que ninguém trata como urgente.
  const diasRestantes = Math.max(0, Math.ceil(30 + DIAS_TOLERANCIA - dias));
  await emitir({ tipo: "loja.mensalidade-recusada", slug: t.slug, nome: t.nome, tentativas, diasRestantes, link: LINK_ASSINATURA, emailContato: t.loginEmail ?? t.emailContato, whatsapp: t.whatsapp });
  return { motivo: `recusada (${tentativas}ª), dentro da tolerância`, tenantId: t.id };
}

// ── Verificação diária (cron via n8n → POST /api/admin/cobranca/verificar) ──

/**
 * Suspende lojas ATIVAS cuja assinatura não está autorizada há mais de
 * DIAS_TOLERANCIA depois do período de teste, e as que ficaram > 30 +
 * tolerância sem pagamento. Lojas sem assinatura têm 14 dias de teste.
 */
export async function verificarInadimplencia(): Promise<{ suspensas: string[]; sincronizadas: number; faturasNovas: number }> {
  const agora = Date.now();
  const lojas = await prisma.tenant.findMany({ where: { status: "ATIVA" } });
  const suspensas: string[] = [];
  let sincronizadas = 0;

  // Puxa o status de quem já tem assinatura antes de julgar qualquer um.
  //
  // O webhook não é confiável como única fonte: em preapproval o Mercado Pago
  // notifica a URL da aplicação, que é uma só para toda a conta da Avila Ops e
  // já apontou para um host desligado. Sem esta sincronização, um lojista que
  // pagou continuaria como PENDENTE e seria suspenso ao fim da tolerância —
  // o pior erro possível para quem está em dia. Falha do MP não derruba a
  // rotina: quem não sincronizou fica como está e é reavaliado amanhã.
  let faturasNovas = 0;
  for (const t of lojas) {
    if (!t.assinaturaId) continue;
    try {
      await sincronizarPreapproval(t.assinaturaId);
      sincronizadas++;
      // As cobranças também vêm daqui: com isso as faturas do painel se
      // preenchem sem webhook nenhum. O upsert é idempotente por externalId.
      const { results } = await buscarCobrancasDaAssinatura(t.assinaturaId);
      for (const c of results ?? []) {
        const r = await aplicarCobranca(c);
        if (r.motivo !== "cobrança já registrada") faturasNovas++;
      }
    } catch (erro) {
      console.error("[assinatura] não consegui sincronizar", t.slug, erro);
    }
  }
  const atuais = sincronizadas ? await prisma.tenant.findMany({ where: { status: "ATIVA" } }) : lojas;

  for (const t of atuais) {
    if (t.cobrancaIsenta) continue; // loja da casa: nem entra no cálculo (suspender() confere de novo)
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
  return { suspensas, sincronizadas, faturasNovas };
}
