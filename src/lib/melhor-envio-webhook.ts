import { createHmac, timingSafeEqual } from "node:crypto";

export const STATUS_MELHOR_ENVIO = new Set([
  "created", "pending", "released", "generated", "received", "posted",
  "delivered", "cancelled", "undelivered", "paused", "suspended",
]);

export function assinaturaMelhorEnvioValida(corpo: string, recebida: string | null, segredo = process.env.MELHOR_ENVIO_CLIENT_SECRET ?? ""): boolean {
  if (!segredo || !recebida) return false;
  const esperada = createHmac("sha256", segredo).update(corpo).digest("base64");
  const a = Buffer.from(recebida.trim());
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}
