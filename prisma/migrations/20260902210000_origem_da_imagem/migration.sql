-- De onde a imagem do produto veio, e o quanto ela é daquele item.
--
-- Imagem plausível de produto errado é pior que ausência de imagem: gera
-- compra errada, devolução e desconfiança. Uma foto de família ("todo 6200 é
-- parecido") pode ser honesta, desde que a vitrine diga que é.
--
-- 'propria' como padrão preserva o comportamento de hoje: o que já está no ar
-- foi importado como foto do próprio item.
ALTER TABLE "Produto"
  ADD COLUMN IF NOT EXISTS "imagemOrigem" TEXT NOT NULL DEFAULT 'propria',
  ADD COLUMN IF NOT EXISTS "imagemFamilia" TEXT;

ALTER TABLE "Produto" DROP CONSTRAINT IF EXISTS "Produto_imagemOrigem_check";
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_imagemOrigem_check"
  CHECK ("imagemOrigem" IN ('propria', 'representativa', 'ilustracao'));

-- Imagem herdada tem que dizer de qual família herdou, senão não há como
-- achar quem a usa no dia em que ela for trocada.
ALTER TABLE "Produto" DROP CONSTRAINT IF EXISTS "Produto_imagemFamilia_check";
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_imagemFamilia_check"
  CHECK ("imagemOrigem" <> 'representativa' OR "imagemFamilia" IS NOT NULL);

CREATE INDEX IF NOT EXISTS "Produto_imagemFamilia_idx"
  ON "Produto" ("tenantId", "imagemFamilia") WHERE "imagemFamilia" IS NOT NULL;
