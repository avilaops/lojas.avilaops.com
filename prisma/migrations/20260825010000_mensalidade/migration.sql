-- Mensalidade da loja (assinatura no Mercado Pago da Avila Ops)
ALTER TABLE "Tenant"
  ADD COLUMN "assinaturaId" TEXT,
  ADD COLUMN "assinaturaStatus" TEXT NOT NULL DEFAULT 'SEM_ASSINATURA',
  ADD COLUMN "assinaturaInitPoint" TEXT,
  ADD COLUMN "ultimoPagamentoEm" TIMESTAMP(3),
  ADD COLUMN "tentativasFalhas" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "suspensaEm" TIMESTAMP(3),
  ADD COLUMN "setupPagoEm" TIMESTAMP(3);
CREATE UNIQUE INDEX "Tenant_assinaturaId_key" ON "Tenant"("assinaturaId");

CREATE TABLE "Fatura" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "centavos" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "detalhe" TEXT,
  "pagaEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Fatura_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Fatura_externalId_key" ON "Fatura"("externalId");
CREATE INDEX "Fatura_tenantId_criadoEm_idx" ON "Fatura"("tenantId", "criadoEm");
ALTER TABLE "Fatura" ADD CONSTRAINT "Fatura_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "CobrancaEvento" (
  "id" TEXT NOT NULL,
  "notificacaoId" TEXT NOT NULL,
  "tenantId" TEXT,
  "topico" TEXT NOT NULL,
  "processadoEm" TIMESTAMP(3),
  "erro" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CobrancaEvento_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CobrancaEvento_notificacaoId_key" ON "CobrancaEvento"("notificacaoId");
ALTER TABLE "CobrancaEvento" ADD CONSTRAINT "CobrancaEvento_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
