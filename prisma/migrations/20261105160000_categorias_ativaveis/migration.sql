ALTER TABLE "Categoria" ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX "Categoria_tenantId_ativo_idx" ON "Categoria"("tenantId", "ativo");
