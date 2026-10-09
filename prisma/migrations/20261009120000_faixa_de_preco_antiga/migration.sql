-- Faixa de preço antiga da loja (ver src/lib/faixas-antigas.ts). Nula = paga a tabela do plano.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "faixaPreco" TEXT;
