import type { Tenant } from "@prisma/client";
import {
  RegistroDeProvedores,
  definicaoMercadoPago,
  definicaoPagBank,
  type DefinicaoProvedor,
  type ProvedorId,
} from "@avilaops/checkout/server";
import { recursoAtivo, type Recurso } from "./recursos";

/**
 * Os provedores de pagamento que esta instância conhece.
 *
 * Provedor novo entra aqui com uma linha `.registrar(...)`. Registrar não liga
 * nada para loja nenhuma: quem decide se a loja vê o provedor é a flag
 * `pagamentos_<id>` (src/lib/recursos.ts), e quem decide se ela cobra com ele
 * é a credencial ativa dela.
 *
 * Mercado Pago não tem flag: é o caminho de sempre (`providerDaLoja`).
 */
const FLAG_DO_PROVEDOR: Partial<Record<ProvedorId, Recurso>> = {
  pagbank: "pagamentos_pagbank",
};

export const provedoresDePagamento = new RegistroDeProvedores().registrar(definicaoMercadoPago).registrar(definicaoPagBank);

/** O que a loja pode ver. Flag ausente ou desligada no ambiente tira o provedor da lista. */
export function definicoesVisiveis(
  t: Pick<Tenant, "recursos">,
  env: Record<string, string | undefined> = process.env,
): DefinicaoProvedor[] {
  return provedoresDePagamento.listar().filter((def) => {
    const flag = FLAG_DO_PROVEDOR[def.id];
    return flag ? recursoAtivo(t, flag, env) : true;
  });
}
