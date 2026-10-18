ALTER TABLE "DocumentoFiscalLoja" ADD COLUMN "fluxosEnfileirados" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
CREATE UNIQUE INDEX "WebhookApi_tenantId_id_key" ON "WebhookApi"("tenantId", "id");

CREATE TABLE "FluxoFiscalLoja" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "webhookId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "finalidade" TEXT NOT NULL,
  "eventos" TEXT[] NOT NULL,
  "campos" TEXT[] NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criadoPor" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "FluxoFiscalLoja_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FluxoFiscalLoja_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "FluxoFiscalLoja_tenantId_webhookId_fkey" FOREIGN KEY ("tenantId", "webhookId") REFERENCES "WebhookApi"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FluxoFiscalLoja_tenantId_webhookId_finalidade_key" ON "FluxoFiscalLoja"("tenantId", "webhookId", "finalidade");
CREATE INDEX "FluxoFiscalLoja_tenantId_ativo_idx" ON "FluxoFiscalLoja"("tenantId", "ativo");
