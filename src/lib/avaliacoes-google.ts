/**
 * Google Avaliações do Consumidor: o convite que o Google mostra na página do
 * pedido pago, perguntando se o comprador aceita avaliar a loja depois da
 * entrega. É o que alimenta a nota do vendedor no Merchant Center.
 *
 * Função pura: decide se há convite e com que dados. Quem carrega o script é
 * `src/components/AvaliacoesGoogle.tsx`, e só depois do "aceito" no aviso de
 * cookies — o convite entrega o e-mail do comprador ao Google.
 */

export interface ConviteAvaliacao {
  merchantId: string;
  pedido: string;
  email: string;
  /** Data estimada de entrega, `AAAA-MM-DD`. O Google manda a pesquisa depois dela. */
  entregaEstimada: string;
}

interface LojaAvaliacoes { googleMerchantId: string | null; despachoDiasUteis: number }
interface PedidoAvaliacoes { referencia: string; status: string; canal: string; clienteEmail: string; fretePrazoDiasUteis: number | null; criadoEm: Date }

const NAO_PAGO = new Set(["AGUARDANDO_PAGAMENTO", "CANCELADO", "ESTORNADO"]);

/** Soma dias úteis (segunda a sexta). Feriado não entra: a data é estimativa, e errar para menos é o que não pode. */
export function somarDiasUteis(inicio: Date, dias: number): Date {
  const d = new Date(Date.UTC(inicio.getUTCFullYear(), inicio.getUTCMonth(), inicio.getUTCDate()));
  let faltam = Math.max(0, Math.round(dias));
  while (faltam > 0) {
    d.setUTCDate(d.getUTCDate() + 1);
    const semana = d.getUTCDay();
    if (semana !== 0 && semana !== 6) faltam--;
  }
  return d;
}

export function conviteAvaliacao(t: LojaAvaliacoes, p: PedidoAvaliacoes): ConviteAvaliacao | null {
  if (!t.googleMerchantId || !/^\d{5,15}$/.test(t.googleMerchantId)) return null;
  // Venda de marketplace é avaliada no marketplace; pedido não pago não é venda.
  if (p.canal !== "loja" || NAO_PAGO.has(p.status)) return null;
  // Sem o prazo do frete não há data honesta de entrega: melhor não convidar.
  if (p.fretePrazoDiasUteis == null || !p.clienteEmail) return null;
  // Despacho da loja mais o trânsito do frete escolhido.
  const entrega = somarDiasUteis(p.criadoEm, Math.max(0, t.despachoDiasUteis) + Math.max(0, p.fretePrazoDiasUteis));
  return { merchantId: t.googleMerchantId, pedido: p.referencia, email: p.clienteEmail, entregaEstimada: entrega.toISOString().slice(0, 10) };
}
