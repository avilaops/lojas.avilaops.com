import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { verificarCarrinhosAbandonados } from "@/lib/carrinhos";

/** POST — rotina de hora em hora (n8n): emite `carrinho.abandonado` para checkouts parados. */
export async function POST(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  return Response.json(await verificarCarrinhosAbandonados());
}
