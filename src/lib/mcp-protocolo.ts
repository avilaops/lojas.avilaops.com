/**
 * O aperto de mão do MCP, sem HTTP: o que a rota `/api/mcp` decide antes de
 * chegar numa ferramenta.
 */

/** Da mais nova para a mais antiga. Só usamos `tools`, que é igual nas três. */
export const VERSOES_DO_PROTOCOLO = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

/**
 * A versão da conversa: a que o cliente pediu, se a conhecemos; senão a nossa
 * mais nova, e o cliente decide se segue. Responder sempre a mesma versão fazia
 * cliente mais novo desistir no aperto de mão.
 */
export function negociarVersao(pedida: unknown): string {
  return typeof pedida === "string" && (VERSOES_DO_PROTOCOLO as readonly string[]).includes(pedida) ? pedida : VERSOES_DO_PROTOCOLO[0];
}

/**
 * Notificação é mensagem sem `id`: não se responde, nem com erro. O cliente
 * manda `notifications/initialized` logo depois do aperto de mão, e devolver
 * 400 ali derrubava a conexão antes da primeira ferramenta.
 */
export function ehNotificacao(mensagem: { id?: unknown; method?: unknown }): boolean {
  return mensagem.id === undefined && typeof mensagem.method === "string";
}

export function erroRpc(id: unknown, code: number, message: string) {
  return { jsonrpc: "2.0" as const, id: id ?? null, error: { code, message } };
}
