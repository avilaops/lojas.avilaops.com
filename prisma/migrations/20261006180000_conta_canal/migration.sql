-- Conta do lojista em marketplace conectado por OAuth (Amazon, Shopee, Magalu).
-- Uma linha por loja e canal. O Mercado Livre segue nas colunas ml* do Tenant.
CREATE TABLE "ContaCanal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "contaId" TEXT,
    "contaNome" TEXT,
    "accessTokenEnc" TEXT NOT NULL,
    "refreshTokenEnc" TEXT NOT NULL,
    "expiraEm" TIMESTAMP(3) NOT NULL,
    "refreshExpiraEm" TIMESTAMP(3),
    "conectadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContaCanal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContaCanal_tenantId_canal_key" ON "ContaCanal"("tenantId", "canal");

ALTER TABLE "ContaCanal" ADD CONSTRAINT "ContaCanal_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
