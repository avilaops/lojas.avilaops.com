-- Compra pela chave publicável: de onde a chave pode comprar, e de onde o
-- pedido entrou. Só acrescenta; chaves e pedidos que existem não mudam.
ALTER TABLE "ChaveApi" ADD COLUMN "origens" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Pedido" ADD COLUMN "origem" TEXT;
