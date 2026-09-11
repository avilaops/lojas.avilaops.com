import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { reconciliarPagamentosPendentes } from "@/lib/pedidos-reconciliar";

/**
 * POST — rotina de hora em hora (n8n Schedule → aqui): confere no gateway os
 * pedidos que ainda aguardam pagamento. É a rede de segurança do webhook; ver
 * src/lib/pedidos-reconciliar.ts.
 *
 * Devolve só contagens: nem id de pagamento nem resposta do gateway saem daqui.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  return Response.json(await reconciliarPagamentosPendentes());
}
