-- Quando o estoque conta como baixo. Serve para dois lados da mesma moeda:
-- o painel avisa o lojista e a loja mostra "últimas unidades" para o comprador.
ALTER TABLE "Tenant" ADD COLUMN "estoqueBaixoEm" INTEGER NOT NULL DEFAULT 3;
