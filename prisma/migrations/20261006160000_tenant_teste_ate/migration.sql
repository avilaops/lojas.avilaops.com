-- Fim do período de teste gravado na loja. Nulo nas lojas que já existem:
-- elas continuam com os 14 dias contados da criação (src/lib/planos.ts).
ALTER TABLE "Tenant" ADD COLUMN "testeAte" TIMESTAMP(3);
