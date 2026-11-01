ALTER TABLE "SolicitacaoSobMedida"
  ADD COLUMN "chaveRetomadaHash" TEXT,
  ADD COLUMN "referenciaOrigem" TEXT;

ALTER TABLE "SolicitacaoSobMedida"
  ADD CONSTRAINT "SolicitacaoSobMedida_chaveRetomadaHash_check"
    CHECK ("chaveRetomadaHash" IS NULL OR "chaveRetomadaHash" ~ '^[0-9a-f]{64}$'),
  ADD CONSTRAINT "SolicitacaoSobMedida_referenciaOrigem_check"
    CHECK ("referenciaOrigem" IS NULL OR "referenciaOrigem" ~ '^CFG-[A-Z0-9]{12}$');

CREATE INDEX "SolicitacaoSobMedida_tenantId_referenciaOrigem_idx"
  ON "SolicitacaoSobMedida"("tenantId", "referenciaOrigem");
