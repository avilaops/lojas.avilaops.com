-- Pedido mínimo por loja, em centavos. Nulo nas lojas que já existem: quem não
-- definiu mínimo segue aceitando pedido de qualquer valor.
ALTER TABLE "Tenant" ADD COLUMN "pedidoMinimoCentavos" INTEGER;
