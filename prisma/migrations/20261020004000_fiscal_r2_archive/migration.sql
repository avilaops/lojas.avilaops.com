ALTER TABLE "DocumentoFiscalLoja" ADD COLUMN "arquivadoEm" TIMESTAMP(3);
CREATE INDEX "DocumentoFiscalLoja_arquivadoEm_recebidoEm_idx" ON "DocumentoFiscalLoja"("arquivadoEm", "recebidoEm");
CREATE INDEX "DocumentoFiscalLoja_tenantId_chave_idx" ON "DocumentoFiscalLoja"("tenantId", "chave");
CREATE INDEX "DocumentoFiscalLoja_tenantId_schema_recebidoEm_idx" ON "DocumentoFiscalLoja"("tenantId", "schema", "recebidoEm");
