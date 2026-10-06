-- Melhor Envio conectado por loja (OAuth). Tudo nulo nas lojas que já existem:
-- sem conexão, a cotação cai na tabela de frete da própria loja, como antes.
ALTER TABLE "Tenant"
  ADD COLUMN "melhorEnvioAccessTokenEnc" TEXT,
  ADD COLUMN "melhorEnvioRefreshTokenEnc" TEXT,
  ADD COLUMN "melhorEnvioExpiraEm" TIMESTAMP(3),
  ADD COLUMN "melhorEnvioConectadoEm" TIMESTAMP(3),
  ADD COLUMN "melhorEnvioConta" TEXT;
