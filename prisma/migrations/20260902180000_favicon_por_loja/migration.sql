-- Ícone da aba por loja. Vazio mantém o comportamento atual: a plataforma
-- desenha a inicial do nome sobre a cor primária.
ALTER TABLE "Tenant" ADD COLUMN "faviconUrl" TEXT;
