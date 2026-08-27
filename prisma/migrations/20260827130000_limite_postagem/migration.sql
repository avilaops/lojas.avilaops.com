-- Teto de postagem adiantada por loja. Zero desliga.
ALTER TABLE "Tenant" ADD COLUMN "limitePostagemCentavos" INTEGER NOT NULL DEFAULT 30000;
