-- Loja da casa (demo, vitrine própria) fica fora da régua de cobrança.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "cobrancaIsenta" BOOLEAN NOT NULL DEFAULT false;
