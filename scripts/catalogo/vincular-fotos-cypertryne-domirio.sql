-- Operação manual para o agrupamento CYPERTRYNE já existente.
BEGIN;
SET LOCAL lock_timeout = '5s';
SELECT set_config('lojas.catalogo_escrita', 'on', true);

DO $$
DECLARE
  loja text;
  raiz "Produto"%ROWTYPE;
  alvo record;
  variante text;
  foto "MidiaProduto"%ROWTYPE;
  revisao constant text := 'reparo:midias-cypertryne-domirio';
BEGIN
  SELECT id INTO STRICT loja FROM "Tenant" WHERE slug = 'domi-rio';
  SELECT * INTO STRICT raiz FROM "Produto"
    WHERE "tenantId" = loja AND slug = 'cypertryne-100' AND ativo
      AND opcoes = ARRAY['Volume']::text[] FOR UPDATE;

  IF EXISTS (
    SELECT 1 FROM "HistoricoCatalogo"
    WHERE "tenantId" = loja AND "produtoId" = raiz.id AND origem = revisao
  ) THEN RETURN; END IF;

  FOR alvo IN
    SELECT * FROM (VALUES
      ('ISO014', '100 mL', 'cypertryne-100', 'mw3zdh0l-c28efd58.webp', 'principal', 0),
      ('ISO014', '100 mL', 'cypertryne-100', 'mw3ze4tc-a1400f1e.webp', 'galeria', 1),
      ('ISO140', '35 mL', 'cypertryne-35', 'mw1jk2dz-cc45b336.webp', 'principal', 0),
      ('ISO015', '1 L', 'cypertryne-1000', 'mw1jhopy-b5cf84a9.webp', 'principal', 0),
      ('ISO015', '1 L', 'cypertryne-1000', 'mw3zfcc1-a30a8292.webp', 'galeria', 1)
    ) AS fotos(sku, volume, slug, arquivo, finalidade, ordem)
  LOOP
    SELECT id INTO STRICT variante FROM "Variante"
      WHERE "tenantId" = loja AND "produtoId" = raiz.id AND ativo
        AND sku = alvo.sku AND valores = jsonb_build_object('Volume', alvo.volume)
      FOR UPDATE;
    SELECT m.* INTO STRICT foto FROM "MidiaProduto" m
      JOIN "Produto" p ON p.id = m."produtoId" AND p."tenantId" = m."tenantId"
      WHERE m."tenantId" = loja AND p.slug = alvo.slug AND m."varianteId" IS NULL
        AND m.tipo = 'imagem' AND m.url = 'https://lojas.avilaops.com/uploads/domi-rio/' || alvo.arquivo;

    INSERT INTO "MidiaProduto" (id, "tenantId", "produtoId", "varianteId", escopo, url, tipo,
      finalidade, ordem, origem, familia, "textoAlternativo", fonte, correspondencia, "larguraPx", "alturaPx", "criadoEm")
    VALUES ('mp_' || md5(foto.id || ':' || variante), loja, raiz.id, variante, variante,
      foto.url, foto.tipo, alvo.finalidade, alvo.ordem, foto.origem, foto.familia, foto."textoAlternativo",
      foto.fonte, foto.correspondencia, foto."larguraPx", foto."alturaPx", foto."criadoEm")
    ON CONFLICT ("produtoId", escopo, url) DO NOTHING;
  END LOOP;

  UPDATE "Produto" SET nome = 'CYPERTRYNE',
    atributos = atributos || '{"imagensPorVolume":true}'::jsonb,
    "versaoCatalogo" = "versaoCatalogo" + 1, "atualizadoEm" = now()
    WHERE id = raiz.id;
  INSERT INTO "HistoricoCatalogo" (id, "tenantId", "produtoId", versao, origem, campos, antes, depois)
    SELECT 'hc_' || md5(revisao || p.id), loja, p.id, p."versaoCatalogo", revisao,
      ARRAY['nome','atributos','midias'], jsonb_build_object('nome', raiz.nome, 'atributos', raiz.atributos),
      jsonb_build_object('nome', p.nome, 'atributos', p.atributos)
    FROM "Produto" p WHERE p.id = raiz.id;
  INSERT INTO "EventoCatalogo" (id, "tenantId", "produtoId", versao)
    SELECT 'ec_' || md5(revisao || p.id), loja, p.id, p."versaoCatalogo"
    FROM "Produto" p WHERE p.id = raiz.id;
END $$;
COMMIT;
