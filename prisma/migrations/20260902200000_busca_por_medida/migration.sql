-- Busca por medida.
--
-- Em catálogo técnico a peça é procurada pela dimensão: "20x47x14" identifica
-- um rolamento tão bem quanto o código. As medidas já estavam em `atributos`
-- (o importador da Vedashow grava diametroInternoMm, diametroExternoMm e
-- alturaMm), mas fora do texto de busca — então a loja respondia "nenhum
-- produto" com o item em estoque e a medida cadastrada.
--
-- O valor entra em duas formas, porque as duas são digitadas:
--   "20 47 14"     cada medida como palavra solta
--   "20x47x14"     junto, do jeito que se fala na oficina
--
-- `trim_scale` tira o zero à direita do numeric (20.0 → 20), senão o texto
-- ficaria "20.0" e nunca casaria com quem digita "20".
CREATE OR REPLACE FUNCTION produto_texto_de_busca() RETURNS trigger AS $$
DECLARE
  motos   TEXT;
  medidas TEXT;
  di TEXT; de TEXT; al TEXT;
BEGIN
  SELECT string_agg(concat_ws(' ', e->>'marca', e->>'modelo'), ' ')
    INTO motos
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(NEW."compatibilidade") = 'array' THEN NEW."compatibilidade" ELSE '[]'::jsonb END) e;

  IF jsonb_typeof(NEW."atributos") = 'object' THEN
    -- `atributos` é JSON livre: o lojista pode ter escrito "20 mm" ou "aprox".
    -- O cast falharia e derrubaria a gravação do produto inteiro, então um
    -- valor não numérico simplesmente não entra na busca.
    BEGIN
      -- trim_scale normaliza "20.00" e "20" na mesma string, senão quem
      -- digita "20" não acha o que está gravado como 20.0.
      di := trim_scale((NEW."atributos"->>'diametroInternoMm')::numeric)::text;
      de := trim_scale((NEW."atributos"->>'diametroExternoMm')::numeric)::text;
      al := trim_scale((NEW."atributos"->>'alturaMm')::numeric)::text;
      medidas := concat_ws(' ', di, de, al, concat_ws('x', di, de, al));
    EXCEPTION WHEN others THEN
      medidas := NULL;
    END;
  END IF;

  NEW."busca" := translate(
    lower(concat_ws(' ', NEW."nome", NEW."marca", NEW."sku", NEW."descricaoCurta", NEW."codigoOriginal", array_to_string(NEW."codigosEquivalentes", ' '), motos, medidas)),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Reindexa o que já existe (o gatilho dispara no UPDATE).
UPDATE "Produto" SET "nome" = "nome";
