-- Agrupa apresentações duplicadas da Domi-Rio por Volume. As variantes
-- vendáveis são movidas, nunca recriadas: SKU, GTIN, preços e estoque ficam
-- nos mesmos identificadores. Cadastros de origem são arquivados para manter
-- referências históricas de pedidos.
BEGIN;
SET LOCAL lock_timeout = '5s';
SELECT set_config('lojas.catalogo_escrita', 'on', true);

DO $$
DECLARE
  tenant_id text;
  familia record;
  i integer;
  raiz_id text;
  produto_id text;
  variante_id text;
  variante_raiz text;
  produtos text[];
  variantes text[];
  ja_agrupada boolean;
  historico_origem constant text := 'migracao:apresentacoes-variacoes-domirio';
  historico_corrigido constant text := 'migracao:apresentacoes-variacoes-domirio-v2';
BEGIN
  SELECT id INTO tenant_id FROM "Tenant" WHERE slug = 'domi-rio' FOR UPDATE;
  IF tenant_id IS NULL THEN RETURN; END IF;

  -- Impede aprovações ou novos itens entre a checagem e a cascata da FK.
  LOCK TABLE "VersaoCatalogoB2B", "ItemCatalogoB2B" IN SHARE ROW EXCLUSIVE MODE;

  FOR familia IN
    SELECT * FROM (VALUES
      ('PIRAZOL TOP', ARRAY['ISO155','ISO202','ISO189']::text[], ARRAY['5 mL','100 mL','1 L']::text[]),
      ('SANEPEC', ARRAY['ISO276','ISO287']::text[], ARRAY['100 mL','1 L']::text[]),
      ('SCORPFIM', ARRAY['ISO245','ISO244']::text[], ARRAY['120 mL','500 mL']::text[]),
      ('TERMITOX 40', ARRAY['ISO001','ISO002','ISO003','ISO095']::text[], ARRAY['60 mL','100 mL','500 mL','1 L']::text[]),
      ('TERMITOX 400', ARRAY['ISO184','ISO007','ISO008','ISO283','ISO009']::text[], ARRAY['20 mL','35 mL','100 mL','500 mL','1 L']::text[]),
      ('TERMITOX SPRAY', ARRAY['ISO011','ISO150','ISO013']::text[], ARRAY['60 mL','120 mL','500 mL']::text[]),
      ('TERMITOX SPRAY DUO', ARRAY['ISO017','ISO018','ISO019']::text[], ARRAY['60 mL','120 mL','500 mL']::text[])
    ) AS f(nome, skus, volumes)
  LOOP
    SELECT p.id INTO raiz_id FROM "Produto" p
      WHERE p."tenantId" = tenant_id AND p.ativo AND (
        p.sku = familia.skus[1] OR EXISTS (
          SELECT 1 FROM "Variante" v
          WHERE v."tenantId" = tenant_id AND v."produtoId" = p.id AND v.padrao AND v.sku = familia.skus[1]
        )
      ) FOR UPDATE;
    IF EXISTS (SELECT 1 FROM "HistoricoCatalogo" WHERE "tenantId" = tenant_id AND "produtoId" = raiz_id AND origem = historico_corrigido) THEN
      CONTINUE;
    END IF;
    ja_agrupada := EXISTS (SELECT 1 FROM "HistoricoCatalogo" WHERE "tenantId" = tenant_id AND "produtoId" = raiz_id AND origem = historico_origem);

    produtos := ARRAY[]::text[]; variantes := ARRAY[]::text[];
    FOR i IN 1..array_length(familia.skus, 1) LOOP
      SELECT id INTO produto_id FROM "Produto"
        WHERE "tenantId" = tenant_id AND (CASE WHEN ja_agrupada AND i = 1 THEN id = raiz_id ELSE sku = familia.skus[i] END)
          AND ativo = (NOT ja_agrupada OR i = 1) FOR UPDATE;
      IF produto_id IS NULL THEN
        RAISE EXCEPTION 'Conversão %: SKU % não está no estado esperado', familia.nome, familia.skus[i];
      END IF;
      produtos := array_append(produtos, produto_id);
      SELECT id INTO variante_id FROM "Variante"
        WHERE "tenantId" = tenant_id AND
          CASE WHEN ja_agrupada THEN "produtoId" = raiz_id AND sku = familia.skus[i]
            AND padrao = (i = 1) AND valores = jsonb_build_object('Volume', familia.volumes[i])
          ELSE "produtoId" = produto_id AND padrao AND ativo END
        FOR UPDATE;
      IF variante_id IS NULL THEN
        RAISE EXCEPTION 'Conversão %: variante do SKU % não está no estado esperado', familia.nome, familia.skus[i];
      END IF;
      variantes := array_append(variantes, variante_id);
    END LOOP;

    IF NOT ja_agrupada AND EXISTS (SELECT 1 FROM "Variante" WHERE "tenantId" = tenant_id AND "produtoId" = ANY(produtos) AND ativo GROUP BY "produtoId" HAVING count(*) <> 1) THEN
      RAISE EXCEPTION 'Conversão %: um SKU de origem já possui grade; revisão manual necessária', familia.nome;
    END IF;
    IF NOT ja_agrupada AND EXISTS (SELECT 1 FROM "ReservaEstoque" WHERE "tenantId" = tenant_id AND "varianteId" = ANY(variantes[2:]) AND estado = 'ATIVA') THEN
      RAISE EXCEPTION 'Conversão %: há reserva de estoque ativa', familia.nome;
    END IF;
    IF NOT ja_agrupada AND EXISTS (
      SELECT 1 FROM "ItemCatalogoB2B" item
      JOIN "VersaoCatalogoB2B" versao ON versao."tenantId" = item."tenantId" AND versao.id = item."versaoId"
      WHERE item."tenantId" = tenant_id AND (
        (item."produtoId" = ANY(produtos) AND item."varianteId" IS NULL)
        OR (item."varianteId" = ANY(variantes[2:]) AND versao.estado = 'APROVADA')
      )
    ) THEN
      RAISE WARNING 'Conversão % adiada: vínculo B2B por produto ou de versão aprovada requer revisão comercial', familia.nome;
      CONTINUE;
    END IF;

    raiz_id := produtos[1]; variante_raiz := variantes[1];
    IF NOT ja_agrupada THEN
      UPDATE "Variante" SET valores = jsonb_build_object('Volume', familia.volumes[1]), nome = familia.volumes[1], ordem = 0 WHERE id = variante_raiz;
      FOR i IN 2..array_length(produtos, 1) LOOP
        UPDATE "Variante" SET padrao = false WHERE id = variantes[i];
        INSERT INTO "Variante" (id, "tenantId", "produtoId", padrao, valores, nome, ativo, ordem)
        VALUES ('cv_' || md5('apresentacao-arquivo:' || produtos[i]), tenant_id, produtos[i], true, '{}'::jsonb, 'Registro arquivado', false, 0);
        UPDATE "Variante" SET "produtoId" = raiz_id, valores = jsonb_build_object('Volume', familia.volumes[i]), nome = familia.volumes[i], ordem = i - 1 WHERE id = variantes[i];
        UPDATE "Produto" SET ativo = false, disponibilidade = 'out_of_stock', "versaoCatalogo" = "versaoCatalogo" + 1 WHERE id = produtos[i];
      END LOOP;
    END IF;

    FOR i IN 1..array_length(produtos, 1) LOOP
      -- Mídias da variante já acompanham a FK. Copie a galeria da origem para
      -- o escopo do volume, mantendo os arquivos e cadastros históricos.
      INSERT INTO "MidiaProduto" (id, "tenantId", "produtoId", "varianteId", escopo, url, tipo, finalidade, ordem,
        origem, familia, "textoAlternativo", fonte, correspondencia, "larguraPx", "alturaPx", "criadoEm")
      SELECT 'mp_' || md5(m.id || ':' || variantes[i]), tenant_id, raiz_id, variantes[i], variantes[i], m.url,
        m.tipo, CASE WHEN EXISTS (
          SELECT 1 FROM "MidiaProduto" especifica WHERE especifica."tenantId" = tenant_id
            AND especifica."produtoId" = raiz_id AND especifica."varianteId" = variantes[i]
            AND especifica.tipo = 'imagem' AND especifica.finalidade = 'principal'
        ) THEN 'galeria' ELSE m.finalidade END,
        m.ordem, m.origem, m.familia, m."textoAlternativo", m.fonte, m.correspondencia,
        m."larguraPx", m."alturaPx", m."criadoEm"
      FROM "MidiaProduto" m
      WHERE m."tenantId" = tenant_id AND m."produtoId" = produtos[i] AND m."varianteId" IS NULL AND m.tipo = 'imagem'
      ON CONFLICT ("produtoId", escopo, url) DO NOTHING;
    END LOOP;
    IF NOT ja_agrupada THEN
      UPDATE "Produto" SET nome = familia.nome, opcoes = ARRAY['Volume']::text[] WHERE id = raiz_id;
    END IF;
    UPDATE "Produto" SET atributos = coalesce(nullif(atributos, 'null'::jsonb), '{}'::jsonb) || '{"imagensPorVolume":true}'::jsonb,
      "versaoCatalogo" = "versaoCatalogo" + 1 WHERE id = raiz_id;

    INSERT INTO "HistoricoCatalogo" (id, "tenantId", "produtoId", versao, origem, campos, antes, depois)
    SELECT 'hc_' || md5('apresentacoes-variacoes:' || p.id || ':' || p."versaoCatalogo"), tenant_id, p.id, p."versaoCatalogo",
      historico_corrigido, CASE WHEN ja_agrupada THEN ARRAY['midias','atributos'] ELSE ARRAY['ativo','opcoes','variantes','midias','atributos'] END,
      jsonb_build_object('nota', 'Estado anterior registrado na migração.'),
      jsonb_build_object('nota', CASE WHEN ja_agrupada THEN 'Mídia vinculada às variantes existentes.' WHEN p.id = raiz_id THEN familia.nome || ' agrupado por Volume.' ELSE 'Cadastro de origem arquivado; variante vendável movida.' END)
    FROM "Produto" p WHERE p.id = raiz_id OR (NOT ja_agrupada AND p.id = ANY(produtos));
    INSERT INTO "EventoCatalogo" (id, "tenantId", "produtoId", versao)
    SELECT 'ec_' || md5('apresentacoes-variacoes:' || p.id || ':' || p."versaoCatalogo"), tenant_id, p.id, p."versaoCatalogo"
    FROM "Produto" p WHERE p.id = raiz_id OR (NOT ja_agrupada AND p.id = ANY(produtos));
  END LOOP;
END $$;
COMMIT;
