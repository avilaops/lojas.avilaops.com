import { createHmac, timingSafeEqual } from "node:crypto";
import type { PedidoStatus } from "@prisma/client";

export const STATUS_MELHOR_ENVIO = new Set([
  "created", "pending", "released", "generated", "received", "posted",
  "delivered", "cancelled", "undelivered", "paused", "suspended",
]);

export type StatusPostagemMelhorEnvio = "carrinho" | "comprada" | "gerada" | "emitida" | "cancelada";
export type StatusPedidoMelhorEnvio = "EM_SEPARACAO" | "ENVIADO" | "ENTREGUE";

const STATUS_POSTAGEM_POR_EVENTO: Partial<Record<string, StatusPostagemMelhorEnvio>> = {
  released: "comprada",
  received: "comprada",
  generated: "gerada",
  posted: "emitida",
  delivered: "emitida",
};

const ORDEM_POSTAGEM: Record<StatusPostagemMelhorEnvio, number> = {
  carrinho: 0,
  comprada: 1,
  gerada: 2,
  emitida: 3,
  cancelada: 4,
};

/** Avança a postagem sem permitir que um webhook atrasado desfaça o painel. */
export function statusPostagemMelhorEnvio(atual: string | null | undefined, evento: string): string {
  if (evento === "cancelled") return atual === "cancelada" ? atual : "cancelada";

  const proposto = STATUS_POSTAGEM_POR_EVENTO[evento];
  if (!proposto || atual === "cancelada") return atual ?? proposto ?? "carrinho";

  const atualConhecido = atual && atual in ORDEM_POSTAGEM ? atual as StatusPostagemMelhorEnvio : null;
  if (!atualConhecido) return proposto;
  return ORDEM_POSTAGEM[proposto] >= ORDEM_POSTAGEM[atualConhecido] ? proposto : atualConhecido;
}

/** Converte um evento externo em um alvo que ainda respeita o ciclo do pedido. */
export function alvoPedidoMelhorEnvio(atual: PedidoStatus, evento: string): PedidoStatus | null {
  if (evento === "delivered") {
    return ["PAGO", "EM_SEPARACAO", "ENVIADO"].includes(atual) ? "ENTREGUE" : null;
  }
  if (evento === "posted") {
    return ["PAGO", "EM_SEPARACAO"].includes(atual) ? "ENVIADO" : null;
  }
  if (["released", "received", "generated"].includes(evento)) {
    return atual === "PAGO" ? "EM_SEPARACAO" : null;
  }
  return null;
}

/** Retorna somente os passos válidos entre dois estados do pedido. */
export function transicoesPedidoMelhorEnvio(atual: PedidoStatus, alvo: PedidoStatus): StatusPedidoMelhorEnvio[] {
  const fluxo: PedidoStatus[] = ["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"];
  const inicio = fluxo.indexOf(atual);
  const fim = fluxo.indexOf(alvo);
  if (inicio < 0 || fim <= inicio) return [];
  return fluxo.slice(inicio + 1, fim + 1).filter((status): status is StatusPedidoMelhorEnvio => status !== "PAGO");
}

export function assinaturaMelhorEnvioValida(corpo: string, recebida: string | null, segredo = process.env.MELHOR_ENVIO_CLIENT_SECRET ?? ""): boolean {
  if (!segredo || !recebida) return false;
  const esperada = createHmac("sha256", segredo).update(corpo).digest("base64");
  const a = Buffer.from(recebida.trim());
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}
