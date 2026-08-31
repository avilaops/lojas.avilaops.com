-- Três meios de pagamento por loja, não um só.
--
-- Regra da casa: sempre Mercado Pago, PayPal e Éfi. Os adaptadores existiam no
-- packages/checkout desde o começo, mas não eram exportados nem tinham onde
-- guardar credencial, então na prática só o Mercado Pago cobrava.
--
-- Segredo entra cifrado com LOJAS_SECRET, igual ao do Mercado Pago. O que não é
-- segredo (client id, webhook id, chave Pix) fica em claro, porque aparece na
-- tela do lojista.

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "gateway" text NOT NULL DEFAULT 'mercadopago';

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "paypalClientId" text;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "paypalSecretEnc" text;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "paypalWebhookId" text;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "paypalSandbox" boolean NOT NULL DEFAULT false;

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "efiClientId" text;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "efiSecretEnc" text;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "efiChavePix" text;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "efiWebhookTokenEnc" text;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "efiSandbox" boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN "Tenant"."gateway" IS 'mercadopago | paypal | efi: quem cobra nesta loja';
