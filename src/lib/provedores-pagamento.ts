import { RegistroDeProvedores, definicaoMercadoPago, definicaoPixManual } from "@avilaops/checkout/server";

/**
 * Os provedores de pagamento que esta instância conhece.
 *
 * Provedor novo entra aqui com uma linha `.registrar(...)`. Registrar não liga
 * nada para loja nenhuma: quem decide se a loja vê o provedor é a flag
 * `pagamentos_<id>` (src/lib/recursos.ts), e quem decide se ela cobra com ele
 * é a credencial ativa dela.
 */
export const provedoresDePagamento = new RegistroDeProvedores().registrar(definicaoMercadoPago).registrar(definicaoPixManual);
