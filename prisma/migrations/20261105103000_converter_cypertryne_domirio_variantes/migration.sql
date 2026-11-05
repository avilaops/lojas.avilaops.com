-- Converte as três apresentações autônomas de CYPERTRYNE da Domi-Rio em uma
-- única ficha com a opção "Volume". As variantes existentes são movidas, em
-- vez de recriadas: SKU, GTIN, preço, saldo, movimentos e itens de pedido
-- continuam apontando para os mesmos identificadores.
BEGIN;

SELECT set_config('lojas.catalogo_escrita', 'on', true);

DO $$
DECLARE
  tenant_id text;
  produto_100 text;
  produto_35 text;
  produto_1l text;
  variante_100 text;
  variante_35 text;
  variante_1l text;
  descricao_tecnica text := $descricao$
ELIMINA NO ATO (Ação imediata): Mosquito da Dengue, Baratas, Moscas, etc.

Cada 100 mL de CYPERTRYNE rende 10 L de calda/solução. Cada 100 mL de CYPERTRYNE tem calda/solução suficiente para aplicação numa área de até 200 m².

DOSAGEM E RECOMENDAÇÃO DE USO

CYPERTRYNE deve ser diluído em água a 1% (ou seja: 100 mL em 10 litros de água). Pulverizar sobre as várias espécies de pragas existentes, utilizando pulverizadores manual, costal ou tratorizado. Em residências, aplicar nos locais onde os insetos se escondem durante o dia (caixas de gordura, atrás de fogões, geladeiras, armários, cantos escuros, etc.).

Lembre-se que a cipermetrina é um inseticida de grande eficácia não somente em insetos domissanitários, mas muito utilizado também no controle de várias pragas que causam danos na agricultura brasileira.

VANTAGENS

• Formulação líquida de fácil manuseio e aplicação
• 100% ativo contra insetos
• Efeito residual
• Ação de choque
• Produto concentrado: permite facilidade no transporte, armazenamento e descarte
• Econômico
• Inodoro (sem cheiro)

TECNOLOGIA

À base de cipermetrina e solventes especiais, é concentrado emulsionável inodoro (sem cheiro) de grande eficácia, permitindo total confiança para os mais exigentes profissionais controladores de pragas.

EFEITO RESIDUAL

Diferentemente de outros métodos de controle, CYPERTRYNE age instantaneamente sobre os insetos em trânsito e permanece no local aplicado por longo tempo, controlando reinfestações que possam surgir. Recomenda-se não lavar o local por alguns dias.

Formando uma barreira química no local aplicado, CYPERTRYNE atua também como repelente a várias espécies de insetos.

SEGURANÇA

CYPERTRYNE é formulado com ingrediente ativo (cipermetrina) utilizado com segurança em vários agroecossistemas no controle de diferentes insetos-praga. É tóxico, porém seguro quando manuseado conforme as recomendações do rótulo (Precauções e Advertências).

RENDIMENTO E CUSTO-BENEFÍCIO

CYPERTRYNE é um produto concentrado, permitindo, conforme laudos de eficácia, uso de baixas dosagens para grandes volumes de solução. Dessa forma, reduz significativamente o custo por tratamento, com total controle dos insetos-praga.

MODO DE AÇÃO

Por ser um inseticida piretróide com amplo espectro de controle, sua ação é imediata: elimina as pragas por ação de choque e mantém-se ativo no local por longo tempo, agindo por contato ou causando repelência. A cipermetrina diminui a atividade e a mobilidade do inseto, gerando impulsos nervosos repetitivos e, consequentemente, a morte.

COMPOSIÇÃO

Cipermetrina: 200 g/L (20% v/v)
Solventes: 800 g/L (80% v/v)

REGISTRO M.S. ANVISA (CYPERTRYNE):
3.3282.0008
$descricao$;
BEGIN
  SELECT id INTO tenant_id FROM "Tenant" WHERE slug = 'domi-rio' FOR UPDATE;
  -- Bancos de teste e outras lojas não possuem a Domi-Rio. Neles a migração
  -- não tem alvo e deve ser inócua; na Domi-Rio, qualquer divergência abaixo
  -- continua abortando a transação inteira.
  IF tenant_id IS NOT NULL THEN

  SELECT id INTO produto_100 FROM "Produto" WHERE "tenantId" = tenant_id AND sku = 'ISO014' AND ativo FOR UPDATE;
  SELECT id INTO produto_35 FROM "Produto" WHERE "tenantId" = tenant_id AND sku = 'ISO140' AND ativo FOR UPDATE;
  SELECT id INTO produto_1l FROM "Produto" WHERE "tenantId" = tenant_id AND sku = 'ISO015' AND ativo FOR UPDATE;
  IF produto_100 IS NULL OR produto_35 IS NULL OR produto_1l IS NULL THEN
    RAISE EXCEPTION 'Conversão CYPERTRYNE: ISO014, ISO140 e ISO015 ativos são obrigatórios';
  END IF;

  SELECT id INTO variante_100 FROM "Variante" WHERE "tenantId" = tenant_id AND "produtoId" = produto_100 AND padrao AND ativo FOR UPDATE;
  SELECT id INTO variante_35 FROM "Variante" WHERE "tenantId" = tenant_id AND "produtoId" = produto_35 AND padrao AND ativo FOR UPDATE;
  SELECT id INTO variante_1l FROM "Variante" WHERE "tenantId" = tenant_id AND "produtoId" = produto_1l AND padrao AND ativo FOR UPDATE;
  IF variante_100 IS NULL OR variante_35 IS NULL OR variante_1l IS NULL THEN
    RAISE EXCEPTION 'Conversão CYPERTRYNE: cada SKU deve ter uma variante padrão ativa';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "Variante"
    WHERE "tenantId" = tenant_id AND "produtoId" IN (produto_100, produto_35, produto_1l) AND ativo
    GROUP BY "produtoId" HAVING count(*) <> 1
  ) THEN
    RAISE EXCEPTION 'Conversão CYPERTRYNE: os SKUs de origem já possuem uma grade; revisão manual necessária';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "ReservaEstoque"
    WHERE "tenantId" = tenant_id AND "varianteId" IN (variante_35, variante_1l) AND estado = 'ATIVA'
  ) THEN
    RAISE EXCEPTION 'Conversão CYPERTRYNE: há reserva de estoque ativa para uma apresentação que será movida';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "ItemCatalogoB2B"
    WHERE "tenantId" = tenant_id AND "produtoId" IN (produto_35, produto_1l) AND "varianteId" IS NULL
  ) THEN
    RAISE EXCEPTION 'Conversão CYPERTRYNE: existe item B2B sem variante nas apresentações de origem';
  END IF;

  -- A ficha antiga permanece como arquivo inativo para manter a referência de
  -- produto em pedidos passados. Cada uma retém uma variante interna, sem
  -- identificadores nem saldo, antes que sua variante vendável seja movida.
  UPDATE "Variante" SET padrao = false WHERE id IN (variante_35, variante_1l);
  INSERT INTO "Variante" (id, "tenantId", "produtoId", padrao, valores, nome, ativo, ordem)
  VALUES
    ('cv_' || md5('cypertryne-arquivo:' || produto_35), tenant_id, produto_35, true, '{}'::jsonb, 'Registro arquivado', false, 0),
    ('cv_' || md5('cypertryne-arquivo:' || produto_1l), tenant_id, produto_1l, true, '{}'::jsonb, 'Registro arquivado', false, 0);

  UPDATE "Variante"
  SET valores = jsonb_build_object('Volume', '100 mL'), nome = '100 mL', ordem = 0
  WHERE id = variante_100;
  UPDATE "Variante"
  SET "produtoId" = produto_100, valores = jsonb_build_object('Volume', '35 mL'), nome = '35 mL', ordem = 1
  WHERE id = variante_35;
  UPDATE "Variante"
  SET "produtoId" = produto_100, valores = jsonb_build_object('Volume', '1 L'), nome = '1 L', ordem = 2
  WHERE id = variante_1l;

  UPDATE "Produto"
  SET nome = 'CYPERTRYNE', descricao = descricao_tecnica, opcoes = ARRAY['Volume']::text[], "versaoCatalogo" = "versaoCatalogo" + 1
  WHERE id = produto_100;
  UPDATE "Produto"
  SET ativo = false, disponibilidade = 'out_of_stock', "versaoCatalogo" = "versaoCatalogo" + 1
  WHERE id IN (produto_35, produto_1l);

  INSERT INTO "HistoricoCatalogo" (id, "tenantId", "produtoId", versao, origem, campos, antes, depois)
  SELECT
    'hc_' || md5('cypertryne-variacoes:' || p.id || ':' || p."versaoCatalogo"),
    tenant_id,
    p.id,
    p."versaoCatalogo",
    'migracao:cypertryne-variacoes-domirio',
    CASE WHEN p.id = produto_100 THEN ARRAY['nome', 'descricao', 'opcoes', 'variantes']::text[] ELSE ARRAY['ativo', 'disponibilidade', 'variantes']::text[] END,
    jsonb_build_object('nota', 'Estado anterior registrado na migração CYPERTRYNE.'),
    jsonb_build_object('nota', CASE WHEN p.id = produto_100 THEN 'CYPERTRYNE agrupado por Volume.' ELSE 'Cadastro de origem arquivado; variante vendável movida ao CYPERTRYNE.' END)
  FROM "Produto" p WHERE p.id IN (produto_100, produto_35, produto_1l);

  INSERT INTO "EventoCatalogo" (id, "tenantId", "produtoId", versao)
  SELECT
    'ec_' || md5('cypertryne-variacoes:' || p.id || ':' || p."versaoCatalogo"),
    tenant_id, p.id, p."versaoCatalogo"
  FROM "Produto" p WHERE p.id IN (produto_100, produto_35, produto_1l);
  END IF;
END $$;

COMMIT;
