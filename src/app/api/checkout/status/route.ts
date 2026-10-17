import { criarRotaStatus } from "@avilaops/checkout/server";
import { resolverRecebimento } from "@/lib/credenciais";
import { consultarPixPorId } from "@/lib/pix-manual";
import { medirRota } from "@/lib/metricas-rota";
import { tenantAtual } from "@/lib/tenant";

/** GET ?id=<pagamento> — a tela do PIX pergunta se já caiu. */
export const GET = medirRota("checkout", async function (request: Request) {
  const t = await tenantAtual();
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  const id = new URL(request.url).searchParams.get("id");
  if (id) {
    const local = await consultarPixPorId(t.id, id);
    if (local) return Response.json(local);
  }
  return criarRotaStatus({ provider: (await resolverRecebimento(t)).provider })(request);
});
