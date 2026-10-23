import assert from "node:assert/strict";
import test from "node:test";
import type { CredencialPagamento, Tenant } from "@prisma/client";
import { cifrar } from "./cofre";
import { contextoDaCredencial } from "./credenciais";

process.env.LOJAS_SECRET ??= "0".repeat(64);

test("credencial legado do Mercado Pago usa o token cifrado do tenant", () => {
  const tenant = { nome: "Loja Exemplo", mpAccessTokenEnc: cifrar("APP_USR-legado") } as Tenant;
  const credencial = {
    provedor: "mercadopago", segredosEnc: null, publicos: {}, webhookToken: "webhook",
  } as CredencialPagamento;

  const contexto = contextoDaCredencial(tenant, credencial);
  assert.equal(contexto.segredos.accessToken, "APP_USR-legado");
});
