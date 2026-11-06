import type { OpcaoFrete } from "@avilaops/checkout";
import { z } from "zod";

const Opcoes = z.array(z.object({
  id: z.string().min(1),
  nome: z.string().min(1),
  preco: z.number().int().nonnegative().safe(),
  prazoDiasUteis: z.number().int().nonnegative().safe(),
}));

export type ItemParaFrete = { id: string; quantidade: number };

/** Nunca interpreta erro HTTP, JSON inválido ou preço ausente como frete grátis. */
export async function consultarFrete(
  entrada: { cep: string; itens: ItemParaFrete[]; cupom?: string },
  signal?: AbortSignal,
  enviar: typeof fetch = fetch,
): Promise<OpcaoFrete[]> {
  const cep = entrada.cep.replace(/\D/g, "");
  if (!/^\d{8}$/.test(cep)) throw new Error("Informe um CEP com 8 dígitos.");
  const resposta = await enviar("/api/frete", {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...entrada, cep }), signal,
  });
  if (!resposta.ok) throw new Error("Não foi possível calcular a entrega. Tente novamente.");
  const dados: unknown = await resposta.json().catch(() => null);
  const validado = Opcoes.safeParse(dados);
  if (!validado.success) throw new Error("A cotação não foi confirmada. Tente novamente.");
  return validado.data;
}
