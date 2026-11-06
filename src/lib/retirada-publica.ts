import type { Tenant } from "@prisma/client";
import { identidadePublica } from "./identidade-publica";

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

/** Apenas o destino já autorizado para visita; nunca divulga endereço privado. */
export function localPublicoDeRetirada(t: Parameters<typeof identidadePublica>[0] & Pick<Tenant, "retiradaNaLoja">) {
  if (!retiradaPublicaDisponivel(t)) return null;
  const identidade = identidadePublica(t);
  if (!identidade.enderecoVisita) return null;
  return { endereco: identidade.enderecoVisita.texto, horario: identidade.horario };
}
