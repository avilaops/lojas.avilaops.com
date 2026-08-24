import { criarRotaStatus } from "@avilaops/checkout/server";
import { tenantAtual } from "@/lib/tenant";
import { providerDaLoja } from "@/lib/gateway";

/** GET ?id=<pagamento> — a tela do PIX pergunta se já caiu. */
export async function GET(request: Request) {
  const t = await tenantAtual();
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  return criarRotaStatus({ provider: providerDaLoja(t) })(request);
}
