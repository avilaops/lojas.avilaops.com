-- A busca volta a achar o que deixou de achar em 17/09/2026.
--
-- `20260917100000_farmacia` redefiniu `produto_texto_de_busca()` para somar
-- `principioAtivo` e `apresentacao`, mas partiu da versão de 26/08 e não da que
-- estava em vigor. `CREATE OR REPLACE` trocou o corpo inteiro sem avisar, e
-- saiu da busca tudo o que duas migrações tinham posto lá:
--
--   - SKU, GTIN, MPN e nome das variações (`LIMPA5L`, `FAB5000`);
--   - código original e equivalentes, e marca/modelo de moto (motopeças);
--   - medidas (`25x52x15`) e atributos curtos de importação;
--   - GTIN do produto.
--
-- Este corpo é a UNIÃO: o de `20260912150000_catalogo_padronizado`, que era o
-- último completo, mais os dois campos da farmácia. Laudo em
-- docs/BUSCA-REGRESSAO.md.
--
-- **Quem mexer nesta função de novo parte DESTE corpo.** A prova que pega a
-- sobrescrita é tests/integration/catalogo.test.ts, que confere um termo de
-- cada origem.
CREATE OR REPLACE FUNCTION produto_texto_de_busca() RETURNS trigger AS $$
DECLARE
  motos     TEXT;
  medidas   TEXT;
  atributos TEXT;
  identificadores TEXT;
  di TEXT; de TEXT; al TEXT;
BEGIN
  SELECT string_agg(concat_ws(' ', e->>'marca', e->>'modelo'), ' ')
    INTO motos
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW."compatibilidade") = 'array' THEN NEW."compatibilidade" ELSE '[]'::jsonb END) e;

  IF jsonb_typeof(NEW."atributos") = 'object' THEN
    BEGIN
      di := trim_scale((NEW."atributos"->>'diametroInternoMm')::numeric)::text;
      de := trim_scale((NEW."atributos"->>'diametroExternoMm')::numeric)::text;
      al := trim_scale((NEW."atributos"->>'alturaMm')::numeric)::text;
      medidas := concat_ws(' ', di, de, al, concat_ws('x', di, de, al));
    EXCEPTION WHEN others THEN
      medidas := NULL;
    END;

    SELECT string_agg(v, ' ')
      INTO atributos
      FROM jsonb_each_text(NEW."atributos") AS kv(k, v)
      WHERE jsonb_typeof(NEW."atributos"->k) = 'string' AND length(v) BETWEEN 1 AND 40;
  END IF;

  SELECT string_agg(concat_ws(' ',v.sku,v.gtin,v.mpn,v.nome), ' ') INTO identificadores
    FROM "Variante" v WHERE v."produtoId"=NEW.id AND v."tenantId"=NEW."tenantId" AND v.ativo;
  NEW."busca" := translate(
    lower(concat_ws(' ', NEW."nome", NEW."marca", NEW."sku", NEW."gtin", NEW."descricaoCurta", NEW."principioAtivo", NEW."apresentacao", NEW."codigoOriginal", array_to_string(NEW."codigosEquivalentes", ' '), motos, medidas, atributos, identificadores)),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Reindexa o que já existe (o gatilho dispara no UPDATE). `busca` é coluna
-- derivada: o que muda é só o texto recalculado a partir do próprio produto.
UPDATE "Produto" SET "nome" = "nome";
