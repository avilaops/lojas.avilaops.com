import { NOMES_DE_ROTINA, type NomeDeRotina } from "./rotinas";

export type ConfiguracaoAgendador = { modo: "DESLIGADO" | "FISCAL" | "COMPLETO"; nomes: NomeDeRotina[] };
const ligado = (valor: string | undefined) => ["1", "true", "sim"].includes((valor ?? "").trim().toLowerCase());
const desligado = (valor: string | undefined) => ["0", "false", "nao", "não"].includes((valor ?? "").trim().toLowerCase());

/** O opt-in fiscal reutiliza o relógio e as travas; não habilita outros trabalhos. */
export function configuracaoAgendador(env: Readonly<Record<string, string | undefined>> = process.env): ConfiguracaoAgendador {
  const geral = ligado(env.ROTINAS_AGENDADOR) || (!desligado(env.ROTINAS_AGENDADOR) && env.NODE_ENV === "production");
  if (geral) return { modo: "COMPLETO", nomes: [...NOMES_DE_ROTINA] };
  if (ligado(env.FISCAL_AGENDADOR)) return { modo: "FISCAL", nomes: ["fiscal.receber"] };
  return { modo: "DESLIGADO", nomes: [] };
}
