-- Preparo do anúncio antes de publicar: nome enriquecido, categoria prevista,
-- diagnóstico dos atributos e o veredito. O JSON guarda o detalhe que a tela
-- mostra; a coluna de estado existe para listar o que falta resolver sem varrer
-- o JSON de milhares de produtos.
ALTER TABLE "AnuncioMercadoLivre"
  ADD COLUMN "preparo" JSONB,
  ADD COLUMN "preparoEstado" TEXT,
  ADD COLUMN "preparadoEm" TIMESTAMP(3);

CREATE INDEX "AnuncioMercadoLivre_tenantId_preparoEstado_idx"
  ON "AnuncioMercadoLivre"("tenantId", "preparoEstado");
