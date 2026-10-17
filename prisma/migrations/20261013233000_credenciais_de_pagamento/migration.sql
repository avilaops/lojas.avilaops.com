-- Credenciais de pagamento por loja (src/lib/credenciais.ts). Aditiva.
-- Reverter (nesta ordem):
--   ALTER TABLE "Pedido" DROP COLUMN "credencialId";
--   ALTER TABLE "Tenant" DROP COLUMN "credencialPadraoId", DROP COLUMN "provedorPadrao";
--   DROP TABLE "CredencialPagamento";
-- As colunas mp* do Tenant não são tocadas: o Mercado Pago segue lendo delas.

CREATE TABLE "CredencialPagamento" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "provedor" TEXT NOT NULL,
    "tipoConexao" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "mensagem" TEXT,
    "segredosEnc" TEXT,
    "publicos" JSONB NOT NULL DEFAULT '{}',
    "webhookToken" TEXT NOT NULL,
    "conta" TEXT,
    "testadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CredencialPagamento_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CredencialPagamento_webhookToken_key" ON "CredencialPagamento"("webhookToken");
CREATE UNIQUE INDEX "CredencialPagamento_tenantId_provedor_key" ON "CredencialPagamento"("tenantId", "provedor");
ALTER TABLE "CredencialPagamento" ADD CONSTRAINT "CredencialPagamento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Tenant" ADD COLUMN "provedorPadrao" TEXT, ADD COLUMN "credencialPadraoId" TEXT;
CREATE UNIQUE INDEX "Tenant_credencialPadraoId_key" ON "Tenant"("credencialPadraoId");
ALTER TABLE "Pedido" ADD COLUMN "credencialId" TEXT;

-- Backfill: toda loja com Mercado Pago ganha a credencial "legado" (segredos
-- seguem nas colunas mp*) e ela vira a padrão. Status "conectado" porque a
-- loja já vende com ela hoje; o próximo teste corrige se não for verdade.
INSERT INTO "CredencialPagamento" ("id", "tenantId", "provedor", "tipoConexao", "status", "publicos", "webhookToken", "conta", "atualizadoEm")
SELECT
  'cp' || substr(md5(random()::text || clock_timestamp()::text || t."id"), 1, 23),
  t."id",
  'mercadopago',
  CASE WHEN t."mpRefreshTokenEnc" IS NOT NULL THEN 'oauth' ELSE 'chave' END,
  'conectado',
  CASE WHEN t."mpPublicKey" IS NOT NULL THEN jsonb_build_object('publicKey', t."mpPublicKey") ELSE '{}'::jsonb END,
  md5(random()::text || clock_timestamp()::text || t."id") || md5(clock_timestamp()::text || random()::text),
  t."mpConta",
  CURRENT_TIMESTAMP
FROM "Tenant" t
WHERE t."mpAccessTokenEnc" IS NOT NULL;

UPDATE "Tenant" t SET "provedorPadrao" = 'mercadopago', "credencialPadraoId" = c."id"
FROM "CredencialPagamento" c
WHERE c."tenantId" = t."id" AND c."provedor" = 'mercadopago';

UPDATE "Pedido" p SET "credencialId" = c."id"
FROM "CredencialPagamento" c
WHERE c."tenantId" = p."tenantId" AND c."provedor" = 'mercadopago' AND p."gateway" = 'mercadopago';
