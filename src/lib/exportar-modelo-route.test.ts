import assert from "node:assert/strict";
import test from "node:test";
import { GET } from "@/app/api/painel/exportar/route";

test("modelo de produtos baixa sem depender de sessão", async () => {
  const resposta = await GET(new Request("https://lojas.avilaops.com/api/painel/exportar?tipo=produtos&formato=xlsx&modelo=1"));

  assert.equal(resposta.status, 200);
  assert.equal(resposta.headers.get("content-disposition"), 'attachment; filename="modelo-produtos.xlsx"');
  assert.match(resposta.headers.get("content-type") ?? "", /spreadsheetml/);
  assert.ok((await resposta.arrayBuffer()).byteLength > 100, "o modelo deve conter uma planilha real");
});
