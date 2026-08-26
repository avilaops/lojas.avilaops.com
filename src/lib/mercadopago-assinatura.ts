import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cliente da API de assinaturas (preapproval) do Mercado Pago — conta da
 * AVILA OPS, não do lojista. É por aqui que a mensalidade da loja é cobrada.
 * Mesmo contrato que o mail.avilaops.com usa (src/lib/mercadopago.ts lá).
 *
 * Env: MP_ACCESS_TOKEN (privado), MP_WEBHOOK_SECRET (assinatura das notificações).
 */
const BASE = "https://api.mercadopago.com";

export class MercadoPagoIndisponivel extends Error {}

function token(): string {
  const t = process.env.MP_ACCESS_TOKEN ?? "";
  if (!t) throw new MercadoPagoIndisponivel("Cobrança da mensalidade ainda não configurada (MP_ACCESS_TOKEN).");
  return t;
}

async function chamar<T>(caminho: string, init: { method: string; body?: unknown }): Promise<T> {
  const r = await fetch(`${BASE}${caminho}`, {
    method: init.method,
    headers: { authorization: `Bearer ${token()}`, "content-type": "application/json" },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(20_000),
  });
  const texto = await r.text();
  let corpo: unknown = null;
  try { corpo = texto ? JSON.parse(texto) : null; } catch { corpo = texto; }
  if (!r.ok) {
    const msg = corpo && typeof corpo === "object" && "message" in corpo ? String((corpo as { message?: unknown }).message) : `Mercado Pago respondeu ${r.status}`;
    console.error("[mp-assinatura]", caminho, r.status, msg);
    throw new Error(msg);
  }
  return corpo as T;
}

export interface Preapproval {
  id: string;
  status: "pending" | "authorized" | "paused" | "cancelled";
  init_point?: string;
  external_reference?: string;
  payer_email?: string;
  auto_recurring?: { transaction_amount?: number };
  next_payment_date?: string;
}

export function criarPreapproval(input: { motivo: string; slug: string; payerEmail: string; valorCentavos: number; backUrl: string }) {
  return chamar<Preapproval>("/preapproval", {
    method: "POST",
    body: {
      reason: input.motivo,
      external_reference: input.slug,
      payer_email: input.payerEmail,
      back_url: input.backUrl,
      // Não adianta mandar notification_url aqui: em preapproval o Mercado
      // Pago aceita o campo, devolve null e continua notificando a URL da
      // aplicação (testado em 26/08/2026). Por isso a rotina diária também
      // sincroniza o status direto na API — ver verificarInadimplencia.
      // Sem status/card_token: o MP devolve init_point e o cartão é cadastrado na página dele.
      auto_recurring: { frequency: 1, frequency_type: "months", transaction_amount: input.valorCentavos / 100, currency_id: "BRL" },
    },
  });
}

export const buscarPreapproval = (id: string) => chamar<Preapproval>(`/preapproval/${id}`, { method: "GET" });
export const alterarPreapproval = (id: string, status: "paused" | "authorized" | "cancelled") => chamar<Preapproval>(`/preapproval/${id}`, { method: "PUT", body: { status } });
export const atualizarValorPreapproval = (id: string, centavos: number) =>
  chamar<Preapproval>(`/preapproval/${id}`, { method: "PUT", body: { auto_recurring: { transaction_amount: centavos / 100, currency_id: "BRL" } } });

export interface PagamentoAutorizado {
  id: number;
  preapproval_id: string;
  status: string; // processed | recycling | scheduled | cancelled
  payment?: { id?: number; status?: string; status_detail?: string };
  transaction_amount?: number;
  debit_date?: string;
}
export const buscarPagamentoAutorizado = (id: string) => chamar<PagamentoAutorizado>(`/authorized_payments/${id}`, { method: "GET" });

/**
 * Confere a assinatura x-signature do webhook (manifesto
 * `id:<data.id>;request-id:<x-request-id>;ts:<ts>;` em HMAC-SHA256 com o
 * segredo da integração). Recusa notificação com mais de 10 min (replay).
 */
export function notificacaoValida(input: { xSignature: string; xRequestId: string; dataId: string }): boolean {
  const segredo = process.env.MP_WEBHOOK_SECRET ?? "";
  if (!segredo) return false;
  const partes = new Map(input.xSignature.split(",").map((p) => p.split("=").map((s) => s.trim())).filter((p): p is [string, string] => p.length === 2));
  const ts = partes.get("ts");
  const v1 = partes.get("v1");
  if (!ts || !v1) return false;
  const idade = Math.abs(Date.now() - Number(ts) * 1000);
  if (!Number.isFinite(idade) || idade > 10 * 60_000) return false;
  const esperada = createHmac("sha256", segredo).update(`id:${input.dataId};request-id:${input.xRequestId};ts:${ts};`).digest("hex");
  return esperada.length === v1.length && timingSafeEqual(Buffer.from(esperada), Buffer.from(v1));
}
