import type { Tenant } from "@prisma/client";

type EnderecoRetirada = {
  logradouro?: string;
  numero?: string;
  bairro?: string;
  cidade?: string;
  uf?: string;
  cep?: string;
};

/** Retirada só é divulgada quando existe um destino completo e público. */
export function retiradaPublicaDisponivel(
  t: Pick<Tenant, "retiradaNaLoja" | "enderecoPublico" | "endereco">,
): boolean {
  if (!t.retiradaNaLoja || !t.enderecoPublico) return false;
  const e = (t.endereco as EnderecoRetirada | null) ?? {};
  const campos = [e.logradouro, e.numero, e.bairro, e.cidade, e.uf];
  return campos.every((valor) => typeof valor === "string" && valor.trim().length > 0)
    && (e.cep ?? "").replace(/\D/g, "").length === 8;
}
