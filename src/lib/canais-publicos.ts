import { numeroParaMeta } from "./whatsapp";

/**
 * Aceita números e sua formatação, sem aproveitar dígitos de texto arbitrário.
 * O + de um DDI estrangeiro explícito é mantido para normalizações sucessivas
 * não interpretarem um número curto internacional como DDD brasileiro.
 */
export function numeroDeContato(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim();
  if (!/^\+?[\d\s().-]+$/.test(limpo)) return null;
  const digitos = limpo.replace(/\D/g, "");
  if (digitos.startsWith("0") || /^(\d)\1+$/.test(digitos)) return null;
  if (limpo.startsWith("+") && !digitos.startsWith("55")) {
    return digitos.length >= 8 && digitos.length <= 15 ? `+${digitos}` : null;
  }
  return numeroParaMeta(limpo);
}

/** E-mail usado em texto e em mailto, sem parâmetros ou controles embutidos. */
export function emailDeContato(valor: unknown): string | null {
  if (typeof valor !== "string") return null;
  const limpo = valor.trim().toLowerCase();
  return /^[^\s@<>?#&]+@[^\s@<>?#&]+\.[a-z]{2,}$/i.test(limpo) ? limpo : null;
}
