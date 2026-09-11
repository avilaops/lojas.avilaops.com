import type { PedidoStatus, Prisma } from "@prisma/client";

/**
 * O filtro da lista de pedidos do painel, como regra pura.
 *
 * Está fora da rota para ser testável sem banco, e para a garantia que
 * importa num painel multi-loja ficar num lugar só: **toda** consulta sai
 * com `tenantId`, e ele vem da sessão, nunca da URL. O teste de isolamento
 * confere isso em cada forma de busca.
 *
 * A busca é a que o lojista fala:
 *   "47" ou "#47"     número do pedido (e também referência, nome, e-mail);
 *   "ronaldo"         nome ou e-mail, sem diferenciar maiúscula;
 *   "16 99314"        telefone, só com quatro dígitos ou mais: com menos,
 *                     "12" casaria com metade da carteira.
 */

export const POR_PAGINA_PEDIDOS = 25;

export const SITUACOES_DE_PEDIDO = ["AGUARDANDO_PAGAMENTO", "PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE", "CANCELADO", "ESTORNADO"] as const satisfies readonly PedidoStatus[];

export function filtroDePedidos(params: { tenantId: string; q?: string | null; situacao?: string | null }): Prisma.PedidoWhereInput {
  const where: Prisma.PedidoWhereInput = { tenantId: params.tenantId };

  const situacao = (params.situacao ?? "").trim();
  if ((SITUACOES_DE_PEDIDO as readonly string[]).includes(situacao)) where.status = situacao as PedidoStatus;

  const q = (params.q ?? "").trim();
  if (q) {
    const digitos = q.replace(/\D/g, "");
    const ou: Prisma.PedidoWhereInput[] = [
      { referencia: { contains: q, mode: "insensitive" } },
      { clienteNome: { contains: q, mode: "insensitive" } },
      { clienteEmail: { contains: q, mode: "insensitive" } },
    ];
    if (digitos && /^#?\d+$/.test(q)) ou.push({ numero: Number(digitos) });
    if (digitos.length >= 4) ou.push({ clienteTelefone: { contains: digitos } });
    where.OR = ou;
  }

  return where;
}

/** "3", "03" e "3.7" viram 3; "-1", "abc" e vazio viram 1. Página nunca é 0. */
export function paginaValida(bruta: string | null | undefined): number {
  const n = Math.trunc(Number(bruta ?? 1));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}
