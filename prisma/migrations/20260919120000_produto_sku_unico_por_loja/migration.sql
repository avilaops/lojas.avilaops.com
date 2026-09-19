-- SKU único por loja.
--
-- `importarProdutos` documenta o SKU como chave de idempotência ("Rodar duas
-- vezes a mesma planilha não duplica nada"), e `salvarProdutoNoCatalogo` já
-- devolve 409 "Já existe um produto ou variação com esse SKU" no P2002 — só a
-- constraint que sustentaria os dois nunca existiu. Enquanto isso a busca era
-- `findFirst` sem `orderBy`: com dois produtos de mesmo SKU na mesma loja, a
-- reimportação atualizava um ao acaso e o outro ficava congelado, com o preço
-- do dia em que entrou. Silencioso, porque a importação responde "atualizado".
--
-- Nulo não colide: índice único do Postgres aceita vários NULL, então produto
-- sem SKU continua entrando normalmente.
--
-- Se esta migração falhar, é porque a loja já tem SKU repetido. Não force:
-- o índice é o que impede o problema de voltar, e apagar o duplicado errado
-- tira do ar um produto publicado. Ache os casos e decida um a um:
--
--   SELECT "tenantId", sku, count(*), array_agg(id)
--   FROM "Produto" WHERE sku IS NOT NULL
--   GROUP BY 1, 2 HAVING count(*) > 1;

DO $$
DECLARE repetidos int;
BEGIN
    SELECT count(*) INTO repetidos FROM (
        SELECT 1 FROM "Produto"
        WHERE sku IS NOT NULL
        GROUP BY "tenantId", sku
        HAVING count(*) > 1
    ) d;

    IF repetidos > 0 THEN
        RAISE EXCEPTION
            'Ha % combinacoes (tenantId, sku) repetidas; o indice unico nao pode ser criado. '
            'Veja a consulta no comentario desta migracao e resolva cada caso antes de aplicar.',
            repetidos;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Produto_tenantId_sku_key" ON "Produto"("tenantId", sku);
