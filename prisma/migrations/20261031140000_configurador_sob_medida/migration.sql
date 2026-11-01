CREATE TABLE "SolicitacaoSobMedida" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "referencia" TEXT NOT NULL,
  "contratoVersao" INTEGER NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'RECEBIDA',
  "nome" TEXT NOT NULL,
  "email" TEXT,
  "telefone" TEXT,
  "configuracao" JSONB NOT NULL,
  "resumo" TEXT NOT NULL,
  "origem" TEXT NOT NULL DEFAULT 'configurador_publico',
  "consentimentoEm" TIMESTAMP(3) NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SolicitacaoSobMedida_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SolicitacaoSobMedida_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "SolicitacaoSobMedida_tenantId_referencia_key" ON "SolicitacaoSobMedida"("tenantId", "referencia");
CREATE INDEX "SolicitacaoSobMedida_tenantId_estado_criadoEm_idx" ON "SolicitacaoSobMedida"("tenantId", "estado", "criadoEm");
