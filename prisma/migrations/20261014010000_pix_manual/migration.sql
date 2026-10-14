-- Cobrança do Pix na conta (provedor pix_manual). A chave e o nome ficam na
-- credencial (publicos), não no Tenant. Aditiva. Reverter:
--   DROP TABLE "CobrancaPixManual";
CREATE TABLE "CobrancaPixManual" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pedidoId" TEXT,
    "referencia" TEXT NOT NULL,
    "txid" TEXT NOT NULL,
    "valorCentavos" INTEGER NOT NULL,
    "copiaECola" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "informadoEm" TIMESTAMP(3),
    "comprovante" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CobrancaPixManual_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CobrancaPixManual_pedidoId_key" ON "CobrancaPixManual"("pedidoId");
CREATE UNIQUE INDEX "CobrancaPixManual_referencia_key" ON "CobrancaPixManual"("referencia");
CREATE INDEX "CobrancaPixManual_tenantId_informadoEm_idx" ON "CobrancaPixManual"("tenantId", "informadoEm");
CREATE INDEX "CobrancaPixManual_expiraEm_idx" ON "CobrancaPixManual"("expiraEm");

ALTER TABLE "CobrancaPixManual" ADD CONSTRAINT "CobrancaPixManual_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CobrancaPixManual" ADD CONSTRAINT "CobrancaPixManual_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
