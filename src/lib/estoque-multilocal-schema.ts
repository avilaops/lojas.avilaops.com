import { z } from "zod";

const local = z.string().trim().min(1).max(80).regex(/^[a-z0-9][a-z0-9_-]*$/, "use código de local em minúsculas");
const campos = {
  varianteId: z.string().trim().min(1).max(100),
  local,
  quantidade: z.number().int().min(1).max(10_000_000),
  motivo: z.string().trim().min(3).max(240),
};

/** Transferência imediata: entrega física já ocorreu; não representa expedição em trânsito. */
export const MovimentoMultilocal = z.discriminatedUnion("tipo", [
  z.object({ ...campos, tipo: z.literal("entrada") }).strict(),
  z.object({ ...campos, tipo: z.literal("saida") }).strict(),
  z.object({ ...campos, tipo: z.literal("transferencia"), destino: local }).strict(),
]).refine(c => c.tipo !== "transferencia" || c.local !== c.destino, "origem e destino precisam ser diferentes");

export const ChaveMovimento = z.string().min(1).max(120).regex(/^[A-Za-z0-9:._-]+$/);
export type MovimentoMultilocalInput = z.infer<typeof MovimentoMultilocal>;
