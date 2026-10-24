import assert from "node:assert/strict";
import test from "node:test";
import { MCP_ADMIN_TOOLS } from "./mcp-admin-tools";

test("ferramentas administrativas têm nomes únicos e schemas fechados", () => {
  assert.equal(new Set(MCP_ADMIN_TOOLS.map((tool) => tool.name)).size, MCP_ADMIN_TOOLS.length);
  assert.deepEqual(
    MCP_ADMIN_TOOLS.map((tool) => tool.name),
    [
      "admin_listar_tenants",
      "admin_obter_tenant",
      "admin_criar_tenant",
      "admin_atualizar_tenant",
      "admin_provisionar_tenant",
      "admin_executar_no_tenant",
    ],
  );
});

test("criação administrativa recusa credenciais fora do contrato MCP", async () => {
  const criar = MCP_ADMIN_TOOLS.find((tool) => tool.name === "admin_criar_tenant");
  assert.ok(criar);

  await assert.rejects(
    criar.handler({
      slug: "loja-segura",
      nome: "Loja Segura",
      mercadoPago: { publicKey: "public_key_123", accessToken: "access_token_123" },
    }),
    /Dados inválidos:.*mercadoPago/,
  );
});

test("alteração administrativa recusa credenciais fora do contrato MCP", async () => {
  const atualizar = MCP_ADMIN_TOOLS.find((tool) => tool.name === "admin_atualizar_tenant");
  assert.ok(atualizar);

  await assert.rejects(
    atualizar.handler({ slug: "loja-segura", apiKeyEnc: "segredo" }),
    /Dados inválidos:.*apiKeyEnc/,
  );
});
