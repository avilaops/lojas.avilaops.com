import { criarRotaStatus } from "@avilaops/checkout/server";
import { tenantAtual } from "@/lib/tenant";
import { providerDaLoja } from "@/lib/gateway";
import { medirRota } from "@/lib/metricas-rota";

/** GET ?id=<pagamento> — a tela do PIX pergunta se já caiu. */
export const GET = medirRota("checkout", async function (request: Request) {
  const t = await tenantAtual();
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  return criarRotaStatus({ provider: providerDaLoja(t) })(request);
});
