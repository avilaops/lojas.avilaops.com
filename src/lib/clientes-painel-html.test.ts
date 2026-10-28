import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext, type AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import Clientes from "@/components/painel/Clientes";

const roteador: AppRouterInstance = {
  back() {}, forward() {}, refresh() {},
  push() {}, replace() {}, prefetch() {},
};

const clientes = [
  {
    email: "ana@example.com",
    nome: "Ana Silva",
    telefone: "(16) 99999-0000",
    documento: "12345678901",
    temConta: true,
    pedidos: 3,
    pedidosPagos: 2,
    gastoCentavos: 15000,
    primeiraCompra: "2026-08-01T12:00:00.000Z",
    ultimaCompra: "2026-10-20T12:00:00.000Z",
    endereco: "Rua Um, 10 - Centro, Franca/SP 14400-000",
  },
];

function renderizar() {
  return renderToStaticMarkup(
    createElement(AppRouterContext.Provider, { value: roteador },
      createElement(Clientes, { clientes }),
    ),
  );
}

test("clientes alterna cartões e planilha sem exigir rolagem horizontal no celular", () => {
  const html = renderizar();

  assert.match(html, /<ul class="[^"]*sm:hidden/);
  assert.match(html, /role="region"/);
  assert.match(html, /aria-label="Clientes em formato de planilha"/);
  assert.match(html, /class="[^"]*sm:block/);
});

test("clientes distingue relacionamento, pedidos registrados e valor realmente pago", () => {
  const html = renderizar();

  for (const cabecalho of ["Cliente", "Contato", "Relacionamento", "Total gasto", "Ticket médio", "Última compra"]) {
    assert.match(html, new RegExp(`>${cabecalho}<`));
  }
  assert.match(html, />Recorrente</);
  assert.match(html, />2 compras pagas</);
  assert.match(html, />3 pedidos registrados</);
  assert.match(html, />R\$\s*75,00</);
});
