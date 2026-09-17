-- Pedido ganha canal de origem e o id do pedido no canal externo.
--
-- Aditivo: todo pedido que já existe é do checkout próprio, e "loja" é o
-- padrão. O par (tenantId, canal, canalPedidoId) é único porque a notificação
-- do Mercado Livre chega repetida — é o índice que impede a mesma venda de
-- virar dois pedidos. Pedido da loja tem canalPedidoId nulo, e no Postgres
-- nulos não colidem entre si, então nada muda para quem já vende.
ALTER TABLE "Pedido" ADD COLUMN "canal" TEXT NOT NULL DEFAULT 'loja';
ALTER TABLE "Pedido" ADD COLUMN "canalPedidoId" TEXT;

CREATE UNIQUE INDEX "Pedido_tenantId_canal_canalPedidoId_key"
  ON "Pedido" ("tenantId", "canal", "canalPedidoId");
