-- Agrupa apresentações duplicadas da Domi-Rio por Volume. As variantes
-- vendáveis são movidas, nunca recriadas: SKU, GTIN, preços e estoque ficam
-- nos mesmos identificadores. Cadastros de origem são arquivados para manter
-- referências históricas de pedidos.
BEGIN;
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
BEGIN
  SELECT id INTO tenant_id FROM "Tenant" WHERE slug = 'domi-rio' FOR UPDATE;
  IF tenant_id IS NULL THEN RETURN; END IF;

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
    produtos := ARRAY[]::text[]; variantes := ARRAY[]::text[];
    FOR i IN 1..array_length(familia.skus, 1) LOOP
      SELECT id INTO produto_id FROM "Produto"
        WHERE "tenantId" = tenant_id AND sku = familia.skus[i] AND ativo FOR UPDATE;
      IF produto_id IS NULL THEN
        RAISE EXCEPTION 'Conversão %: SKU % ativo é obrigatório', familia.nome, familia.skus[i];
      END IF;
      produtos := array_append(produtos, produto_id);
      SELECT id INTO variante_id FROM "Variante"
        WHERE "tenantId" = tenant_id AND "produtoId" = produto_id AND padrao AND ativo FOR UPDATE;
      IF variante_id IS NULL THEN
        RAISE EXCEPTION 'Conversão %: SKU % requer variante padrão ativa', familia.nome, familia.skus[i];
      END IF;
      variantes := array_append(variantes, variante_id);
    END LOOP;

    IF EXISTS (SELECT 1 FROM "Variante" WHERE "tenantId" = tenant_id AND "produtoId" = ANY(produtos) AND ativo GROUP BY "produtoId" HAVING count(*) <> 1) THEN
      RAISE EXCEPTION 'Conversão %: um SKU de origem já possui grade; revisão manual necessária', familia.nome;
    END IF;
    IF EXISTS (SELECT 1 FROM "ReservaEstoque" WHERE "tenantId" = tenant_id AND "varianteId" = ANY(variantes[2:]) AND estado = 'ATIVA') THEN
      RAISE EXCEPTION 'Conversão %: há reserva de estoque ativa', familia.nome;
    END IF;
    IF EXISTS (SELECT 1 FROM "ItemCatalogoB2B" WHERE "tenantId" = tenant_id AND "produtoId" = ANY(produtos[2:]) AND "varianteId" IS NULL) THEN
      RAISE EXCEPTION 'Conversão %: existe item B2B sem variante', familia.nome;
    END IF;

    raiz_id := produtos[1]; variante_raiz := variantes[1];
    UPDATE "Variante" SET valores = jsonb_build_object('Volume', familia.volumes[1]), nome = familia.volumes[1], ordem = 0 WHERE id = variante_raiz;
    FOR i IN 2..array_length(produtos, 1) LOOP
      UPDATE "Variante" SET padrao = false WHERE id = variantes[i];
      INSERT INTO "Variante" (id, "tenantId", "produtoId", padrao, valores, nome, ativo, ordem)
      VALUES ('cv_' || md5('apresentacao-arquivo:' || produtos[i]), tenant_id, produtos[i], true, '{}'::jsonb, 'Registro arquivado', false, 0);
      UPDATE "Variante" SET "produtoId" = raiz_id, valores = jsonb_build_object('Volume', familia.volumes[i]), nome = familia.volumes[i], ordem = i - 1 WHERE id = variantes[i];
      UPDATE "Produto" SET ativo = false, disponibilidade = 'out_of_stock', "versaoCatalogo" = "versaoCatalogo" + 1 WHERE id = produtos[i];
    END LOOP;
    UPDATE "Produto" SET nome = familia.nome, opcoes = ARRAY['Volume']::text[], "versaoCatalogo" = "versaoCatalogo" + 1 WHERE id = raiz_id;

    INSERT INTO "HistoricoCatalogo" (id, "tenantId", "produtoId", versao, origem, campos, antes, depois)
    SELECT 'hc_' || md5('apresentacoes-variacoes:' || p.id || ':' || p."versaoCatalogo"), tenant_id, p.id, p."versaoCatalogo",
      'migracao:apresentacoes-variacoes-domirio', ARRAY['ativo','opcoes','variantes']::text[],
      jsonb_build_object('nota', 'Estado anterior registrado na migração.'),
      jsonb_build_object('nota', CASE WHEN p.id = raiz_id THEN familia.nome || ' agrupado por Volume.' ELSE 'Cadastro de origem arquivado; variante vendável movida.' END)
    FROM "Produto" p WHERE p.id = ANY(produtos);
    INSERT INTO "EventoCatalogo" (id, "tenantId", "produtoId", versao)
    SELECT 'ec_' || md5('apresentacoes-variacoes:' || p.id || ':' || p."versaoCatalogo"), tenant_id, p.id, p."versaoCatalogo"
    FROM "Produto" p WHERE p.id = ANY(produtos);
  END LOOP;
END $$;
COMMIT;
