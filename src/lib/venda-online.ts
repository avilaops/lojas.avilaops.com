import type { Tenant } from "@prisma/client";

/** A mesma decisão governa o checkout e os textos públicos da loja. */
export function vendaOnlineDisponivel(t: Pick<Tenant, "status" | "plano" | "provedorPadrao" | "mpAccessTokenEnc" | "credencialPadraoId">): boolean {
  if (t.status !== "ATIVA" || t.plano === "SITE") return false;
  if (!t.provedorPadrao || t.provedorPadrao === "mercadopago") return Boolean(t.mpAccessTokenEnc);
  return Boolean(t.credencialPadraoId);
}
