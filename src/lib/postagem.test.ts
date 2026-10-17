import { test } from "node:test";
import assert from "node:assert/strict";
import type { Pedido, Tenant } from "@prisma/client";
import { bloqueioDeEtiqueta, emitirEtiqueta, PedidoSemEtiqueta } from "./postagem";

test("só pedido pago gera etiqueta", () => {
  assert.equal(bloqueioDeEtiqueta("AGUARDANDO_PAGAMENTO"), "Este pedido ainda não foi pago.");
  assert.equal(bloqueioDeEtiqueta("CANCELADO"), "Pedido cancelado não gera etiqueta.");
  assert.equal(bloqueioDeEtiqueta("ESTORNADO"), "Pedido cancelado não gera etiqueta.");
  for (const pago of ["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"] as const) {
    assert.equal(bloqueioDeEtiqueta(pago), null, pago);
  }
});

test("pedido não pago é recusado antes de qualquer consulta ou chamada à CepCerto", async () => {
  // Tenant e pedido sem banco nem chave: se a emissão passasse da trava, quebraria
  // em outra coisa (Melhor Envio, Postagem, CepCerto) e não em PedidoSemEtiqueta.
  const tenant = {} as Tenant;
  for (const status of ["AGUARDANDO_PAGAMENTO", "CANCELADO", "ESTORNADO"] as const) {
    const pedido = { id: "p1", status, itens: [] } as unknown as Pedido & { itens: [] };
    await assert.rejects(emitirEtiqueta(tenant, pedido), PedidoSemEtiqueta, status);
  }
});
