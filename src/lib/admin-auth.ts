import { timingSafeEqual } from "node:crypto";

/**
 * Autenticação da API administrativa (/api/admin/*).
 *
 * Quem chama é máquina: o n8n de onboarding e o portal cliente.avilaops.com.
 * Um token estático em LOJAS_ADMIN_TOKEN, comparado em tempo constante.
 * Lojista nunca fala com esta API — ele usa o painel do portal, que fala aqui.
 */
export function autorizado(request: Request): boolean {
  const esperado = process.env.LOJAS_ADMIN_TOKEN ?? "";
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!esperado || !token || token.length !== esperado.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(esperado));
}

export function naoAutorizado(): Response {
  return Response.json({ erro: "não autorizado" }, { status: 401 });
}
