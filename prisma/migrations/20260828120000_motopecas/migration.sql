-- Segmento "motopecas": garagem (peças por moto), compatibilidade e busca
-- por código original. Nada por loja em código: o segmento é dado do tenant
-- e a compatibilidade é dado do produto.
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "segmento" TEXT NOT NULL DEFAULT 'geral';

ALTER TABLE "Produto"
  ADD COLUMN IF NOT EXISTS "codigoOriginal" TEXT,
  ADD COLUMN IF NOT EXISTS "codigosEquivalentes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "compatibilidade" JSONB NOT NULL DEFAULT '[]';

-- A busca passa a achar por código original, código equivalente e pela moto
-- ("cg 160", "fazer 250") — é assim que o mecânico e o dono da moto procuram.
CREATE OR REPLACE FUNCTION produto_texto_de_busca() RETURNS trigger AS $$
DECLARE
  motos TEXT;
BEGIN
  SELECT string_agg(concat_ws(' ', e->>'marca', e->>'modelo'), ' ')
    INTO motos
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW."compatibilidade") = 'array' THEN NEW."compatibilidade" ELSE '[]'::jsonb END) e;
  NEW."busca" := translate(
    lower(concat_ws(' ', NEW."nome", NEW."marca", NEW."sku", NEW."descricaoCurta", NEW."codigoOriginal", array_to_string(NEW."codigosEquivalentes", ' '), motos)),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE "Produto" SET "nome" = "nome";
