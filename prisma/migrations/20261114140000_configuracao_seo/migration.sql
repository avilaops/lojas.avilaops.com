-- Defaults preserve the existing automatic metadata and twelve llms.txt highlights.
ALTER TABLE "Tenant" ADD COLUMN "configuracaoSeo" JSONB NOT NULL DEFAULT '{}';
