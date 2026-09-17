BEGIN;

-- Entrega feita pela propria loja (motoboy, frota), por prefixo de CEP.
-- Lista vazia = a loja nao entrega por conta propria, que e o comportamento
-- atual de todas as lojas ja provisionadas.
ALTER TABLE "Tenant" ADD COLUMN "entregaLocal" JSONB NOT NULL DEFAULT '[]';

COMMIT;
