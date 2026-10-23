CREATE TABLE "AcessoLoja" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "email" TEXT NOT NULL,
  "papel" TEXT NOT NULL DEFAULT 'DONO', "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcessoLoja_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AcessoLoja_tenantId_email_key" ON "AcessoLoja"("tenantId", "email");
CREATE INDEX "AcessoLoja_email_ativo_idx" ON "AcessoLoja"("email", "ativo");
ALTER TABLE "AcessoLoja" ADD CONSTRAINT "AcessoLoja_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Migração reversível e idempotência por tenant. Não migra operadores para proprietário.
INSERT INTO "AcessoLoja" ("id","tenantId","email","papel")
SELECT 'owner-' || "id", "id", lower(trim("loginEmail")), 'DONO'
FROM "Tenant" WHERE "loginEmail" IS NOT NULL AND trim("loginEmail") <> ''
ON CONFLICT ("tenantId", "email") DO NOTHING;
