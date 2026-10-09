import type { Plano, Tenant } from "@prisma/client";
import { prisma } from "./db";
import { emitir } from "./eventos";
import { esquecerTenantEmCache } from "./tenant";
import { fimDoTeste } from "./planos";
import { alterarPreapproval, atualizarValorPreapproval, buscarCobrancasDaAssinatura, buscarPagamentoAutorizado, buscarPreapproval, criarPreapproval, type PagamentoAutorizado } from "./mercadopago-assinatura";
import { alertar } from "./alertas";

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
export const PRECO_PLANO: Record<Plano, number> = { SITE: 11000, LOJA: 26900, LOJA_PRO: 49700 };
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

/**
 * Cancela a mensalidade no Mercado Pago e, só então, aqui.
 *
 * A ordem importa: antes a falha do Mercado Pago era só um `console.error`, e
 * a loja ficava "cancelada" no nosso banco com a assinatura ainda cobrando o
 * cartão do lojista todo mês — o pior desencontro possível. Agora, se o
 * Mercado Pago não confirmar, nada muda e quem pediu recebe o erro.
 *
 * Uma exceção: quando a assinatura já está cancelada lá (alguém cancelou pelo
 * painel do Mercado Pago), a alteração é recusada, mas o estado é o que
 * queríamos. Confere lendo de volta antes de desistir.
 */
export async function cancelarAssinatura(t: Tenant) {
  if (t.assinaturaId) {
    try {
      await alterarPreapproval(t.assinaturaId, "cancelled");
    } catch (erro) {
      const atual = await buscarPreapproval(t.assinaturaId).catch(() => null);
      if (atual?.status !== "cancelled") throw erro;
    }
  }
  await prisma.tenant.update({ where: { id: t.id }, data: { assinaturaStatus: "CANCELADA", assinaturaInitPoint: null } });
  esquecerTenantEmCache(t.slug);
}

/**
 * Suspender e reativar loja é decisão de gente, não da rotina (Nicolas,
 * 08/10/2026). A plataforma só enxerga pagamento feito pela assinatura do
 * Mercado Pago; quem paga por fora parecia inadimplente, e a rotina suspendeu
 * loja que ninguém tinha cobrado. Por padrão ela só aponta quem cairia na
 * regra (`aSuspender` no resultado da rotina) e o status muda à mão, por
 * `PATCH /api/admin/tenants/<slug>`. `LOJAS_SUSPENSAO_AUTOMATICA=true` religa.
 */
export function suspensaoAutomatica(env: Record<string, string | undefined> = process.env): boolean {
  return env.LOJAS_SUSPENSAO_AUTOMATICA === "true";
}

async function suspender(t: Tenant, motivo: string): Promise<boolean> {
  if (!suspensaoAutomatica()) {
    console.warn(`[assinatura] ${t.slug} cairia em suspensão (${motivo}); suspensão automática desligada`);
    return false;
  }
  // A isenção mora aqui, no único ponto por onde toda suspensão passa. Ela
  // nasceu só dentro da rotina diária e a demo foi suspensa assim mesmo: o
  // caminho do webhook (assinatura cancelada no Mercado Pago) não conhecia a
  // regra. Guard no lugar errado é guard que um caminho novo esquece.
  if (t.cobrancaIsenta) return false;
  if (t.status === "SUSPENSA" || t.status === "CANCELADA") return false;
  // Quem suspende é quem muda a linha: o webhook e a varredura diária chegam
  // juntos, cada um com o `t` que leu antes, e os dois avisavam o lojista.
  const mudou = await prisma.tenant.updateMany({ where: { id: t.id, status: t.status }, data: { status: "SUSPENSA", suspensaEm: new Date() } });
  if (mudou.count !== 1) return false;
  esquecerTenantEmCache(t.slug);
  await emitir({ tipo: "loja.suspensa", slug: t.slug, nome: t.nome, motivo, link: LINK_ASSINATURA, emailContato: t.loginEmail ?? t.emailContato, whatsapp: t.whatsapp });
  return true;
}

async function reativar(t: Tenant) {
  // Mesma regra: quem suspendeu à mão é quem reativa.
  if (!suspensaoAutomatica()) return;
  if (t.status !== "SUSPENSA") return;
  const mudou = await prisma.tenant.updateMany({ where: { id: t.id, status: "SUSPENSA" }, data: { status: "ATIVA", suspensaEm: null } });
  if (mudou.count !== 1) return;
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
    const mensagem = String(erro instanceof Error ? erro.message : erro);
    await prisma.cobrancaEvento.update({ where: { id: evento.id }, data: { erro: mensagem.slice(0, 2000) } });
    // A rota responde 200 mesmo assim, então o Mercado Pago não reenvia: sem o
    // alerta, a única chance de alguém saber é a varredura do dia seguinte.
    await alertar({ codigo: "mensalidade.webhook-falhou", slug: "plataforma", lojaNome: "Plataforma", recurso: chave, detalhe: mensagem });
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
    await emitir({ tipo: "loja.mensalidade-paga", slug: t.slug, nome: t.nome, centavos, emailContato: t.loginEmail ?? t.emailContato, whatsapp: t.whatsapp }, { chave: `paga:${c.id}` });
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
  await emitir({ tipo: "loja.mensalidade-recusada", slug: t.slug, nome: t.nome, tentativas, diasRestantes, link: LINK_ASSINATURA, emailContato: t.loginEmail ?? t.emailContato, whatsapp: t.whatsapp }, { chave: `recusada:${c.id}:${situacao}` });
  return { motivo: `recusada (${tentativas}ª), dentro da tolerância`, tenantId: t.id };
}

/**
 * Por que esta loja cairia na régua de inadimplência, ou `null` se não cairia.
 *
 * Não olha a isenção de propósito: é a pergunta "e se ela não fosse isenta?",
 * que a rotina diária faz depois de pular as isentas e que o controle de
 * isenção faz ANTES de tirar a isenção de alguém, para mostrar a consequência.
 */
export function motivoDeInadimplencia(t: Tenant, agora = Date.now()): string | null {
  if (t.plano === "SITE" && t.assinaturaStatus === "SEM_ASSINATURA") return null;
  const diasDesdeFimDoTeste = (agora - fimDoTeste(t).getTime()) / 86_400_000;
  const diasDesdePagamento = t.ultimoPagamentoEm ? (agora - t.ultimoPagamentoEm.getTime()) / 86_400_000 : null;
  if (t.assinaturaStatus !== "AUTORIZADA" && diasDesdeFimDoTeste > DIAS_TOLERANCIA && !t.setupPagoEm) return "período de teste encerrado sem assinatura";
  if (t.assinaturaStatus === "AUTORIZADA" && diasDesdePagamento !== null && diasDesdePagamento > 30 + DIAS_TOLERANCIA) return "mais de um mês sem pagamento confirmado";
  return null;
}

/**
 * A isenção de mensalidade de uma loja e o que tirá-la provocaria.
 *
 * Isenta quer dizer: a plataforma não cobra esta loja (ela paga por fora, ou é
 * da casa) e a régua de inadimplência a ignora. Tirar a isenção NÃO cria
 * assinatura nem cobrança — isso continua sendo um ato à parte ("iniciar"). O
 * que muda é que a loja passa a ser avaliada pela régua, e `seNaoFosseIsenta`
 * diz hoje o que a régua concluiria.
 */
export function situacaoDaIsencao(t: Tenant, agora = Date.now()) {
  return {
    isenta: t.cobrancaIsenta,
    plano: t.plano,
    statusDaLoja: t.status,
    assinaturaStatus: t.assinaturaStatus,
    temAssinatura: Boolean(t.assinaturaId),
    suspensaoAutomatica: suspensaoAutomatica(),
    seNaoFosseIsenta: t.status === "ATIVA" ? motivoDeInadimplencia(t, agora) : null,
  };
}

/** Marca ou tira a isenção. Só isso: não cria assinatura, não muda o status da loja, não avisa o lojista. */
export async function definirIsencao(t: Tenant, isenta: boolean) {
  const depois = await prisma.tenant.update({ where: { id: t.id }, data: { cobrancaIsenta: isenta } });
  esquecerTenantEmCache(t.slug);
  return depois;
}

// ── Verificação diária (cron via n8n → POST /api/admin/cobranca/verificar) ──

/**
 * Suspende lojas ATIVAS cuja assinatura não está autorizada há mais de
 * DIAS_TOLERANCIA depois do período de teste, e as que ficaram > 30 +
 * tolerância sem pagamento. O fim do teste é o de `fimDoTeste` (planos.ts).
 */
export async function verificarInadimplencia(): Promise<{ suspensas: string[]; aSuspender: Array<{ slug: string; motivo: string }>; sincronizadas: number; faturasNovas: number }> {
  const agora = Date.now();
  const lojas = await prisma.tenant.findMany({ where: { status: "ATIVA" } });
  const suspensas: string[] = [];
  const aSuspender: Array<{ slug: string; motivo: string }> = [];
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
    const motivo = motivoDeInadimplencia(t, agora);
    if (motivo) {
      if (await suspender(t, motivo)) suspensas.push(t.slug);
      else if (!t.cobrancaIsenta) aSuspender.push({ slug: t.slug, motivo });
    }
  }
  return { suspensas, aSuspender, sincronizadas, faturasNovas };
}
