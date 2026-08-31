-- Volta a um gateway só: Mercado Pago.
--
-- Decisão de escopo do Nicolas em 31/08/2026. As colunas de PayPal e Éfi
-- nasceram algumas horas antes, nunca foram preenchidas por nenhuma loja e
-- saem agora: coluna órfã em tabela de pagamento é convite a alguém achar que
-- existe um caminho que ninguém mantém.
--
-- Os adaptadores continuam no packages/checkout, fora do caminho, para o dia
-- em que a decisão mudar.

ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "gateway";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "paypalClientId";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "paypalSecretEnc";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "paypalWebhookId";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "paypalSandbox";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "efiClientId";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "efiSecretEnc";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "efiChavePix";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "efiWebhookTokenEnc";
ALTER TABLE "Tenant" DROP COLUMN IF EXISTS "efiSandbox";
