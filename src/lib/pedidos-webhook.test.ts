import assert from "node:assert/strict";
import test from "node:test";

/**
 * Regras que decidem se um pedido vira PAGO, testadas sem banco.
 *
 * `atualizarStatusPagamento` fala com o Prisma, então o que dá para testar
 * puro é a decisão: dado o estado do pedido e o que o gateway respondeu,
 * confirma ou não confirma. As três regras abaixo são cópia exata das
 * condições de `src/lib/pedidos.ts`, e existem porque cada uma delas evita um
 * prejuízo diferente:
 *
 *   valor divergente  -> pagamento de um real fechando pedido de quinhentos
 *   já não aguardando -> webhook repetido baixando estoque duas vezes
 *   estorno           -> dinheiro devolvido e pedido seguindo como pago
 *
 * Quando `pedidos.ts` mudar, estes testes precisam mudar junto: são a
 * regressão da mudança que passou a conferir valor, compartilhada por todas as
 * lojas da plataforma.
 */

const MAPA: Record<string, string | undefined> = {
  aprovado: "PAGO",
  recusado: "CANCELADO",
  cancelado: "CANCELADO",
  estornado: "ESTORNADO",
};

/** A decisão de `atualizarStatusPagamento`, isolada do banco. */
function decidir(
  pedido: { status: string; totalCentavos: number },
  gateway: { status: string; valorEmCentavos?: number },
): { novoStatus?: string; baixaEstoque: boolean; divergencia: boolean } {
  const novo = MAPA[gateway.status];
  const avancaDeAguardando = pedido.status === "AGUARDANDO_PAGAMENTO";

  if (novo === "PAGO" && gateway.valorEmCentavos != null && gateway.valorEmCentavos !== pedido.totalCentavos) {
    return { baixaEstoque: false, divergencia: true };
  }

  const aplica = novo && (avancaDeAguardando || novo === "ESTORNADO");
  return {
    novoStatus: aplica ? novo : undefined,
    baixaEstoque: novo === "PAGO" && avancaDeAguardando,
    divergencia: false,
  };
}

const AGUARDANDO = { status: "AGUARDANDO_PAGAMENTO", totalCentavos: 4200 };

test("pagamento aprovado no valor certo confirma e baixa estoque", () => {
  const r = decidir(AGUARDANDO, { status: "aprovado", valorEmCentavos: 4200 });
  assert.equal(r.novoStatus, "PAGO");
  assert.equal(r.baixaEstoque, true);
  assert.equal(r.divergencia, false);
});

test("valor menor que o pedido NÃO confirma", () => {
  const r = decidir(AGUARDANDO, { status: "aprovado", valorEmCentavos: 100 });
  assert.equal(r.divergencia, true);
  assert.equal(r.novoStatus, undefined);
  assert.equal(r.baixaEstoque, false, "estoque não sai sem o dinheiro certo");
});

test("valor maior também não confirma: divergência é divergência", () => {
  const r = decidir(AGUARDANDO, { status: "aprovado", valorEmCentavos: 999900 });
  assert.equal(r.divergencia, true);
  assert.equal(r.novoStatus, undefined);
});

test("webhook repetido não baixa estoque de novo", () => {
  // O Mercado Pago reenvia a mesma notificação até receber 200, e reenvia
  // também quando o pagamento é consultado no painel.
  const jaPago = { status: "PAGO", totalCentavos: 4200 };
  const r = decidir(jaPago, { status: "aprovado", valorEmCentavos: 4200 });
  assert.equal(r.baixaEstoque, false);
  assert.equal(r.novoStatus, undefined, "o pedido já está pago; nada muda");
});

test("pedido já enviado não volta para pago por evento fora de ordem", () => {
  const enviado = { status: "ENVIADO", totalCentavos: 4200 };
  const r = decidir(enviado, { status: "aprovado", valorEmCentavos: 4200 });
  assert.equal(r.novoStatus, undefined);
  assert.equal(r.baixaEstoque, false);
});

test("estorno vale mesmo com o pedido já enviado", () => {
  // O dinheiro voltou para o cliente: o pedido não pode seguir como pago só
  // porque já saiu da etapa de pagamento.
  const enviado = { status: "ENVIADO", totalCentavos: 4200 };
  assert.equal(decidir(enviado, { status: "estornado" }).novoStatus, "ESTORNADO");
});

test("recusado cancela quando ainda aguardava", () => {
  assert.equal(decidir(AGUARDANDO, { status: "recusado" }).novoStatus, "CANCELADO");
});

test("pendente não muda o pedido: Pix esperando pagamento continua aguardando", () => {
  const r = decidir(AGUARDANDO, { status: "pendente" });
  assert.equal(r.novoStatus, undefined);
  assert.equal(r.baixaEstoque, false);
});

test("status desconhecido do gateway não confirma nada", () => {
  const r = decidir(AGUARDANDO, { status: "em_analise_manual", valorEmCentavos: 4200 });
  assert.equal(r.novoStatus, undefined);
  assert.equal(r.baixaEstoque, false);
});

test("sem valor informado, a conferência não bloqueia (compatibilidade)", () => {
  // Provedor que ainda não repassa o valor não pode parar de funcionar; o que
  // não pode é confirmar valor ERRADO em silêncio.
  const r = decidir(AGUARDANDO, { status: "aprovado" });
  assert.equal(r.novoStatus, "PAGO");
  assert.equal(r.divergencia, false);
});
