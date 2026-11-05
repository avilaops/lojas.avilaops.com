import test from "node:test";
import assert from "node:assert/strict";
import { condicaoDoCatalogo, filtroDaUrl } from "./catalogo-filtros";

test("filtro do catálogo mantém o tenant sem filtro de marca", async () => {
  assert.deepEqual(await condicaoDoCatalogo("loja-1", {}), { tenantId: "loja-1" });
});

test("filtro da URL preserva marca e categoria para a tela e exportação", () => {
  const url = new URL("https://loja.test/api/painel/catalogo?marca=POWELL&categoria=rolamentos");
  assert.deepEqual(filtroDaUrl(url), { marca: "POWELL", categoria: "rolamentos", situacao: undefined, busca: undefined });
});
