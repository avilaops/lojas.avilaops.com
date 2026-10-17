-- Flags por loja (src/lib/recursos.ts). Aditiva: toda loja nasce com a lista
-- vazia, que é o comportamento de sempre. Reverter:
--   ALTER TABLE "Tenant" DROP COLUMN "recursos";
ALTER TABLE "Tenant" ADD COLUMN "recursos" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
