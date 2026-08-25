-- Variações de produto, cupons e baixa de estoque
ALTER TABLE "Produto" ADD COLUMN "opcoes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "Variante" (
  "id" TEXT NOT NULL,
  "produtoId" TEXT NOT NULL,
  "valores" JSONB NOT NULL,
  "nome" TEXT NOT NULL,
  "sku" TEXT,
  "precoCentavos" INTEGER,
  "estoque" INTEGER,
  "pesoKg" DOUBLE PRECISION,
  "imagem" TEXT,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "ordem" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "Variante_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Variante_produtoId_ativo_idx" ON "Variante"("produtoId", "ativo");
ALTER TABLE "Variante" ADD CONSTRAINT "Variante_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Cupom" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "codigo" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "valor" INTEGER NOT NULL DEFAULT 0,
  "minimoCentavos" INTEGER NOT NULL DEFAULT 0,
  "usosMax" INTEGER,
  "usos" INTEGER NOT NULL DEFAULT 0,
  "validoAte" TIMESTAMP(3),
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Cupom_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Cupom_tenantId_codigo_key" ON "Cupom"("tenantId", "codigo");
ALTER TABLE "Cupom" ADD CONSTRAINT "Cupom_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PedidoItem" ADD COLUMN "varianteId" TEXT, ADD COLUMN "varianteNome" TEXT;
ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_varianteId_fkey" FOREIGN KEY ("varianteId") REFERENCES "Variante"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Pedido" ADD COLUMN "cupomCodigo" TEXT, ADD COLUMN "estoqueBaixado" BOOLEAN NOT NULL DEFAULT false;
