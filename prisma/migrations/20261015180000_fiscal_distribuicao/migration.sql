CREATE TABLE "FiscalLoja" (
  "tenantId" TEXT NOT NULL PRIMARY KEY REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "cnpj" TEXT NOT NULL,
  "uf" TEXT NOT NULL,
  "certificadoEnc" TEXT NOT NULL,
  "titular" TEXT NOT NULL,
  "validoAte" TIMESTAMP(3) NOT NULL,
  "ultimoNsu" TEXT NOT NULL DEFAULT '000000000000000',
  "proximaConsultaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ultimaMensagem" TEXT
);
CREATE TABLE "DocumentoFiscalLoja" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "cnpj" TEXT NOT NULL,
  "nsu" TEXT NOT NULL,
  "schema" TEXT NOT NULL,
  "chave" TEXT,
  "xml" TEXT NOT NULL,
  "recebidoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "FiscalLoja_cnpj_key" ON "FiscalLoja"("cnpj");
CREATE UNIQUE INDEX "DocumentoFiscalLoja_tenantId_cnpj_nsu_key" ON "DocumentoFiscalLoja"("tenantId", "cnpj", "nsu");
CREATE INDEX "DocumentoFiscalLoja_tenantId_recebidoEm_idx" ON "DocumentoFiscalLoja"("tenantId", "recebidoEm");
