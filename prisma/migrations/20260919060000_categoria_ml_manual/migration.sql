-- Origem da categoria do anúncio: quem a decidiu. O padrão "automatica"
-- descreve exatamente o que existe hoje — toda linha gravada até aqui veio do
-- preditor do Mercado Livre —, então a migração não reclassifica nada.
ALTER TABLE "AnuncioMercadoLivre" ADD COLUMN "categoriaOrigem" TEXT NOT NULL DEFAULT 'automatica';
ALTER TABLE "AnuncioMercadoLivre" ADD COLUMN "categoriaDefinidaEm" TIMESTAMP(3);

-- Listar "o que o lojista escolheu a dedo" sem varrer o catálogo inteiro.
CREATE INDEX "AnuncioMercadoLivre_tenantId_categoriaOrigem_idx" ON "AnuncioMercadoLivre"("tenantId", "categoriaOrigem");
