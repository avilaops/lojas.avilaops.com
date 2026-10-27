import type { Tenant } from "@prisma/client";

/**
 * Flags por loja: o que está ligado só para algumas lojas enquanto é novo.
 *
 * Mora em `Tenant.recursos` (lista de texto, vazia por padrão). Nome novo entra
 * em RECURSOS antes de ser usado; nome desconhecido no banco é ignorado.
 *
 * `LOJAS_RECURSOS_DESLIGADOS` (separados por vírgula) desliga um recurso para
 * todas as lojas de uma vez, sem migração: é o botão de pânico.
 */
export const RECURSOS = [
  /** Nova tela Configurações → Recebimento, com escolha de provedor. */
  "recebimento_v2",
  "pagamentos_pagbank",
  "pagamentos_pagarme",
  "pagamentos_cielo",
  /** Pix direto na conta do lojista, com baixa manual. */
  "pagamentos_pix_manual",
  /** Conta e cotações de teste do Melhor Envio, sem atender lojas reais. */
  "frete_melhor_envio_sandbox",
] as const;
export type Recurso = (typeof RECURSOS)[number];

export function ehRecurso(valor: unknown): valor is Recurso {
  return typeof valor === "string" && (RECURSOS as readonly string[]).includes(valor);
}

function desligadosNoAmbiente(env: Record<string, string | undefined>): Set<string> {
  return new Set((env.LOJAS_RECURSOS_DESLIGADOS ?? "").split(",").map((s) => s.trim()).filter(Boolean));
}

export function recursoAtivo(t: Pick<Tenant, "recursos">, recurso: Recurso, env: Record<string, string | undefined> = process.env): boolean {
  if (desligadosNoAmbiente(env).has(recurso)) return false;
  return (t.recursos ?? []).includes(recurso);
}

export function recursosAtivos(t: Pick<Tenant, "recursos">, env: Record<string, string | undefined> = process.env): Recurso[] {
  return RECURSOS.filter((r) => recursoAtivo(t, r, env));
}

/** A loja recebe pelo Pix na própria conta, conferido à mão. */
export function pixNaConta(t: Pick<Tenant, "provedorPadrao" | "recursos">): boolean {
  return t.provedorPadrao === "pix_manual" && recursoAtivo(t, "pagamentos_pix_manual");
}

/** Pix na conta só tem Pix: cartão e boleto não passam por ele. */
export function meiosAceitos(t: Pick<Tenant, "provedorPadrao" | "recursos" | "meiosPagamento">): string[] {
  return pixNaConta(t) ? ["pix"] : t.meiosPagamento;
}

const NOME_DO_MEIO: Record<string, string> = { pix: "Pix", cartao: "cartão", boleto: "boleto" };

/** "Pix, cartão e boleto." / "Pix." — a frase dos meios que a loja aceita de verdade. */
export function rotuloDosMeios(meios: string[]): string {
  const nomes = ["pix", "cartao", "boleto"].filter((m) => meios.includes(m)).map((m) => NOME_DO_MEIO[m]);
  if (nomes.length === 0) return "Nenhum meio de pagamento ligado.";
  const frase = nomes.length === 1 ? nomes[0] : `${nomes.slice(0, -1).join(", ")} e ${nomes[nomes.length - 1]}`;
  return `${frase.charAt(0).toUpperCase()}${frase.slice(1)}.`;
}
