-- SEO de categorias V1.
-- O conteúdo é produzido offline (painel, MCP ou rotina n8n) e a vitrine
-- pública apenas lê os campos persistidos. Categorias existentes começam
-- pendentes para entrarem na primeira execução da rotina.
ALTER TABLE "Categoria"
  ADD COLUMN IF NOT EXISTS "seoTitle" TEXT,
  ADD COLUMN IF NOT EXISTS "seoDescription" TEXT,
  ADD COLUMN IF NOT EXISTS "seoKeywords" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "seoPendente" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "seoOrigem" TEXT,
  ADD COLUMN IF NOT EXISTS "seoModelo" TEXT,
  ADD COLUMN IF NOT EXISTS "seoAtualizadoEm" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "seoProcessandoEm" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "seoErro" TEXT,
  ADD COLUMN IF NOT EXISTS "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "Categoria_tenantId_seoPendente_idx"
  ON "Categoria"("tenantId", "seoPendente");
