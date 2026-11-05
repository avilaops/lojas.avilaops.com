ALTER TABLE "Pedido" ADD COLUMN "freteId" TEXT;

ALTER TABLE "Postagem"
  ADD COLUMN "provedor" TEXT NOT NULL DEFAULT 'cepcerto',
  ADD COLUMN "provedorId" TEXT,
  ADD COLUMN "provedorProtocolo" TEXT,
  ADD COLUMN "provedorStatus" TEXT,
  ADD COLUMN "rastreioUrl" TEXT;

CREATE INDEX "Postagem_tenantId_provedor_provedorId_idx"
  ON "Postagem"("tenantId", "provedor", "provedorId");
