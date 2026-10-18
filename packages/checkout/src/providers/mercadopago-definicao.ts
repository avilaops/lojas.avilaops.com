import { MercadoPagoProvider } from "./mercadopago.ts";
import type { DefinicaoProvedor } from "./types.ts";

/**
 * Mercado Pago no registro. `segredos.accessToken` é obrigatório;
 * `segredos.webhookSecret` é opcional (sem ele, só a conciliação confirma).
 */
export const definicaoMercadoPago: DefinicaoProvedor = {
  id: "mercadopago",
  nome: "Mercado Pago",
  capacidades: { pix: true, cartao: true, boleto: true, estorno: true, estornoParcial: true, webhook: true, confirmacaoAutomatica: true },
  tipoConexao: "oauth",
  campos: [],
  guia: [],
  async testarConexao({ segredos }) {
    const token = segredos.accessToken?.trim();
    if (!token) return { ok: false, mensagem: "Nenhuma conta conectada ainda. Conecte o Mercado Pago.", avisos: [] };
    const avisos = token.startsWith("TEST-") ? ["Esta é uma credencial de TESTE: as vendas não entram de verdade."] : [];
    let r: Response;
    try {
      r = await fetch("https://api.mercadopago.com/users/me", { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
    } catch {
      return { ok: false, mensagem: "Não consegui falar com o Mercado Pago agora. Tente de novo em alguns minutos.", avisos };
    }
    if (r.status === 401 || r.status === 403) return { ok: false, mensagem: "O Mercado Pago recusou o acesso. Conecte a conta de novo.", avisos };
    if (!r.ok) return { ok: false, mensagem: `O Mercado Pago respondeu com erro (${r.status}). Tente de novo daqui a pouco.`, avisos };
    const u = (await r.json().catch(() => ({}))) as { nickname?: string; email?: string };
    return { ok: true, mensagem: "Conta conectada e pronta para receber.", conta: u.nickname ?? u.email, avisos };
  },
  criar({ segredos, notificationUrl, descritorFatura }) {
    const accessToken = segredos.accessToken;
    if (!accessToken) throw new Error("Mercado Pago sem access token.");
    return new MercadoPagoProvider({
      accessToken,
      webhookSecret: segredos.webhookSecret,
      descritorFatura,
      pixExpiraEmMinutos: 30,
      notificationUrl,
    });
  },
};
