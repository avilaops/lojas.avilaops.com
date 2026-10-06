-- Google Avaliações do Consumidor (Merchant Center), por loja.
--
-- `googleMerchantId` liga o convite de avaliação na página do pedido pago;
-- `googleSeloAvaliacoes` liga o selo flutuante na vitrine, que é escolha da
-- loja (sem nota ainda, o selo diz "nenhuma classificação disponível").
--
-- O convite pede a data estimada de entrega, e o pedido não guardava o prazo
-- do frete escolhido: `fretePrazoDiasUteis` passa a guardar. Pedido antigo fica
-- nulo e não gera convite — data inventada faria o Google perguntar da entrega
-- antes de ela chegar.
ALTER TABLE "Tenant" ADD COLUMN "googleMerchantId" TEXT, ADD COLUMN "googleSeloAvaliacoes" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Pedido" ADD COLUMN "fretePrazoDiasUteis" INTEGER;

-- A conta da Brilhax já existe (Merchant Center 5839051326). O selo fica
-- desligado: liga-se no painel quando houver nota para mostrar.
UPDATE "Tenant" SET "googleMerchantId" = '5839051326' WHERE slug = 'brilhax' AND "googleMerchantId" IS NULL;
