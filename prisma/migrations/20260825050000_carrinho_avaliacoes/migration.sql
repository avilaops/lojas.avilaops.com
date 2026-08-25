-- Carrinho abandonado (checkout identificado sem pedido) e avaliações de produto
CREATE TABLE "CheckoutAberto" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "referencia" TEXT NOT NULL,
  "clienteNome" TEXT NOT NULL,
  "clienteEmail" TEXT NOT NULL,
  "clienteTelefone" TEXT NOT NULL,
  "itens" JSONB NOT NULL,
  "totalCentavos" INTEGER NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'ABERTO',
  "lembradoEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CheckoutAberto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CheckoutAberto_referencia_key" ON "CheckoutAberto"("referencia");
CREATE INDEX "CheckoutAberto_tenantId_status_criadoEm_idx" ON "CheckoutAberto"("tenantId", "status", "criadoEm");
ALTER TABLE "CheckoutAberto" ADD CONSTRAINT "CheckoutAberto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Avaliacao" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "produtoId" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "nota" INTEGER NOT NULL,
  "texto" TEXT,
  "aprovada" BOOLEAN NOT NULL DEFAULT false,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Avaliacao_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Avaliacao_produtoId_aprovada_idx" ON "Avaliacao"("produtoId", "aprovada");
CREATE INDEX "Avaliacao_tenantId_aprovada_criadoEm_idx" ON "Avaliacao"("tenantId", "aprovada", "criadoEm");
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Avaliacao" ADD CONSTRAINT "Avaliacao_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
