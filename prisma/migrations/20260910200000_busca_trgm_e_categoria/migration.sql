-- Busca por trigrama e listagem por categoria com índice (10/09/2026).
--
-- Medido no Postgres de produção com 5.867 produtos:
--
--   busca LIKE '%6205%' AND LIKE '%2rs%'   Seq Scan, 70 ms   →  0,26 ms
--   busca LIKE '%retentor%' (1.988 acertos) Seq Scan, 126 ms  →  5,8 ms
--   produtos de uma categoria, página 3     Seq Scan, 126 ms  →  6,3 ms
--
-- O índice btree (tenantId, busca) que existia não serve para `%termo%`:
-- btree só resolve prefixo. Sem isto a busca cresce linear com o catálogo,
-- e a 100 mil produtos seria mais de um segundo por tecla.
--
-- pg_trgm é extensão "confiável" desde o PG 13: o papel da aplicação
-- (`lojas`, sem superusuário) consegue instalá-la, conferido antes de
-- escrever esta migração.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX "Produto_busca_trgm_idx" ON "Produto" USING gin (busca gin_trgm_ops);

-- Categoria: 71 valores distintos em 5.867 linhas; uma categoria seleciona
-- ~1/50 do catálogo, e o planner troca o Seq Scan pelo índice. destaque e
-- nome entram porque é a ordem padrão da listagem ("relevância").
CREATE INDEX "Produto_tenantId_categoriaId_destaque_nome_idx" ON "Produto" ("tenantId", "categoriaId", "destaque", "nome");

-- ---------------------------------------------------------------------------
-- O que entra no texto de busca: gtin e os atributos de texto.
--
-- Faltavam o código de barras (quem tem o produto na mão lê o EAN da caixa)
-- e os atributos que o lojista cadastra como texto ("subtipo": "2RS",
-- "vedacao": "borracha", "serie": "62"). A descrição longa fica de fora de
-- propósito: é prosa, e prosa no índice faz "borracha" trazer a loja inteira.
-- Só valor curto (até 40 caracteres) e só string: número já entra pelas
-- medidas, e objeto aninhado não é atributo, é erro de importação.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION produto_texto_de_busca() RETURNS trigger AS $$
DECLARE
  motos     TEXT;
  medidas   TEXT;
  atributos TEXT;
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

  NEW."busca" := translate(
    lower(concat_ws(' ', NEW."nome", NEW."marca", NEW."sku", NEW."gtin", NEW."descricaoCurta", NEW."codigoOriginal", array_to_string(NEW."codigosEquivalentes", ' '), motos, medidas, atributos)),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Reindexa o que já existe (o gatilho dispara no UPDATE).
UPDATE "Produto" SET "nome" = "nome";
