CREATE TABLE "DemandaBuscaPk" (
  "tenantId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "consulta" TEXT NOT NULL,
  "dia" DATE NOT NULL,
  "ocorrencias" INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT "DemandaBuscaPk_pkey" PRIMARY KEY ("tenantId", "tipo", "consulta", "dia"),
  CONSTRAINT "DemandaBuscaPk_tipo_check" CHECK ("tipo" IN ('codigo', 'medidas', 'familia-material')),
  CONSTRAINT "DemandaBuscaPk_ocorrencias_check" CHECK ("ocorrencias" > 0),
  CONSTRAINT "DemandaBuscaPk_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "DemandaBuscaPk_tenantId_dia_idx" ON "DemandaBuscaPk"("tenantId", "dia");
