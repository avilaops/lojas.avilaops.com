import { tenantAtual } from "@/lib/tenant";
import { medirRota } from "@/lib/metricas-rota";
import { responderPendencia } from "@/lib/checkout-pendente";

/**
 * GET ?referencia=<referência> — o /checkout pergunta se a referência que
 * ficou pendente no navegador já resolveu, antes de abrir o formulário.
 *
 * Só leitura, só da própria loja, e responde apenas a situação: o mesmo que a
 * página `/pedido/[referencia]` já revela a quem tem a referência.
 */
export const GET = medirRota("checkout", async function (request: Request) {
  return responderPendencia(await tenantAtual(), request.url);
});
