-- Regras comerciais por canal de venda (Mercado Livre hoje; Amazon, Shopee e
-- Magalu na mesma chave quando entrarem). Objeto vazio = o padrão do código,
-- que é o comportamento que a integração já tinha: sem acréscimo, sem reserva.
ALTER TABLE "Tenant" ADD COLUMN "canais" JSONB NOT NULL DEFAULT '{}';
