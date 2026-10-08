-- Mercado Pago conectado por OAuth. Tudo nulo nas lojas que já existem: quem
-- colou as chaves à mão segue cobrando com elas, sem mudança nenhuma.
ALTER TABLE "Tenant"
  ADD COLUMN "mpRefreshTokenEnc" TEXT,
  ADD COLUMN "mpExpiraEm" TIMESTAMP(3),
  ADD COLUMN "mpConectadoEm" TIMESTAMP(3),
  ADD COLUMN "mpUserId" TEXT,
  ADD COLUMN "mpConta" TEXT;
