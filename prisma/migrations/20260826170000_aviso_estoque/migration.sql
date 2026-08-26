-- Fila de espera por produto sem estoque: demanda que a loja perdia calada.
CREATE TABLE "AvisoEstoque" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "telefone" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "avisadoEm" TIMESTAMP(3),
    CONSTRAINT "AvisoEstoque_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AvisoEstoque_produtoId_email_key" ON "AvisoEstoque"("produtoId", "email");
CREATE INDEX "AvisoEstoque_tenantId_avisadoEm_idx" ON "AvisoEstoque"("tenantId", "avisadoEm");
ALTER TABLE "AvisoEstoque" ADD CONSTRAINT "AvisoEstoque_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AvisoEstoque" ADD CONSTRAINT "AvisoEstoque_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
