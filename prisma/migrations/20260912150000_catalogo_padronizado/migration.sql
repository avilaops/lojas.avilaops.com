BEGIN;
-- DropForeignKey
ALTER TABLE "Variante" DROP CONSTRAINT "Variante_produtoId_fkey";

-- AlterTable
ALTER TABLE "Produto" ADD COLUMN     "versaoCatalogo" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "Variante" ADD COLUMN     "alturaCm" DOUBLE PRECISION,
ADD COLUMN     "comprimentoCm" DOUBLE PRECISION,
ADD COLUMN     "disponibilidade" TEXT NOT NULL DEFAULT 'in_stock',
ADD COLUMN     "gtin" TEXT,
ADD COLUMN     "identificadoresEstado" TEXT NOT NULL DEFAULT 'desconhecido',
ADD COLUMN     "larguraCm" DOUBLE PRECISION,
ADD COLUMN     "mpn" TEXT,
ADD COLUMN     "padrao" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tenantId" TEXT;

UPDATE "Variante" v SET "tenantId"=p."tenantId" FROM "Produto" p WHERE p.id=v."produtoId";
ALTER TABLE "Variante" ALTER COLUMN "tenantId" SET NOT NULL;

-- CreateTable
CREATE TABLE "PrecoVariante" (
    "varianteId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "moeda" TEXT NOT NULL DEFAULT 'BRL',
    "valorCentavos" INTEGER NOT NULL,
    "comparacaoCentavos" INTEGER,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PrecoVariante_pkey" PRIMARY KEY ("varianteId")
);

-- CreateTable
CREATE TABLE "SaldoEstoque" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "varianteId" TEXT NOT NULL,
    "local" TEXT NOT NULL DEFAULT 'principal',
    "fisico" INTEGER,
    "reservado" INTEGER NOT NULL DEFAULT 0,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaldoEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReservaEstoque" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "varianteId" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'ATIVA',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReservaEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TentativaCatalogo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "resumoHash" TEXT NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'RESERVADA',
    "pagamentoId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TentativaCatalogo_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TentativaCatalogo_referencia_key" ON "TentativaCatalogo"("referencia");

-- CreateTable
CREATE TABLE "MovimentoEstoque" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "varianteId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "quantidade" INTEGER NOT NULL,
    "motivo" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MovimentoEstoque_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MidiaProduto" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "varianteId" TEXT,
    "escopo" TEXT NOT NULL DEFAULT 'produto',
    "url" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'imagem',
    "finalidade" TEXT NOT NULL DEFAULT 'galeria',
    "ordem" INTEGER NOT NULL DEFAULT 0,
    "origem" TEXT NOT NULL DEFAULT 'propria',
    "familia" TEXT,
    "textoAlternativo" TEXT,
    "fonte" TEXT,
    "correspondencia" TEXT NOT NULL DEFAULT 'nao_confirmada',
    "larguraPx" INTEGER,
    "alturaPx" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MidiaProduto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PublicacaoCanal" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "varianteId" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "contaExterna" TEXT NOT NULL DEFAULT '',
    "idExterno" TEXT NOT NULL,
    "versaoEnviada" INTEGER,
    "estadoEnvio" TEXT NOT NULL DEFAULT 'NAO_ENVIADO',
    "resultadoExterno" TEXT NOT NULL DEFAULT 'NAO_CONSULTADO',
    "enviadoEm" TIMESTAMP(3),
    "consultadoEm" TIMESTAMP(3),
    "problemas" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "PublicacaoCanal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HistoricoCatalogo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "origem" TEXT NOT NULL,
    "campos" TEXT[],
    "antes" JSONB NOT NULL,
    "depois" JSONB NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HistoricoCatalogo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventoCatalogo" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "produtoId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'catalogo.alterado',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processadoEm" TIMESTAMP(3),

    CONSTRAINT "EventoCatalogo_pkey" PRIMARY KEY ("id")
);


-- Migração de dados sob a mesma transação do DDL. Nenhuma identidade é inventada.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM "Produto" p WHERE cardinality(p.opcoes)>0 AND NOT EXISTS(SELECT 1 FROM "Variante" v WHERE v."produtoId"=p.id AND v.ativo)) THEN
  RAISE EXCEPTION 'Catálogo com opções sem variantes: revisar antes da migração';
 END IF;
 IF EXISTS(SELECT 1 FROM "Produto" p WHERE cardinality(p.opcoes)=0 AND EXISTS(SELECT 1 FROM "Variante" v WHERE v."produtoId"=p.id)) THEN
  RAISE EXCEPTION 'Produto simples com variantes legadas: revisar antes da migração';
 END IF;
END $$;
-- Snapshot preserva os 31 campos e as variantes antes da conversão.
INSERT INTO "HistoricoCatalogo" (id,"tenantId","produtoId",versao,origem,campos,antes,depois)
SELECT 'hc_'||md5(p.id),p."tenantId",p.id,1,'migracao:catalogo-v1',ARRAY['migracao'],
 jsonb_build_object('produto',to_jsonb(p),'variantes',COALESCE((SELECT jsonb_agg(to_jsonb(v)) FROM "Variante" v WHERE v."produtoId"=p.id),'[]')), '{}'::jsonb
FROM "Produto" p;
INSERT INTO "Variante" (id,"tenantId","produtoId",padrao,valores,nome,sku,gtin,"identificadoresEstado","precoCentavos",estoque,"pesoKg","alturaCm","larguraCm","comprimentoCm",disponibilidade,imagem,ativo,ordem)
SELECT 'vp_'||md5(p.id),p."tenantId",p.id,true,'{}', 'Apresentação única',nullif(p.sku,''),nullif(p.gtin,''),
 CASE WHEN nullif(p.gtin,'') IS NOT NULL THEN 'informado' ELSE 'desconhecido' END,
 p."precoCentavos",p.estoque,p."pesoKg",p."alturaCm",p."larguraCm",p."comprimentoCm",p.disponibilidade,p.imagens[1],true,0
FROM "Produto" p WHERE cardinality(p.opcoes)=0;
-- Resolve heranças comerciais uma única vez; GTIN e SKU do pai NÃO vão aos filhos.
UPDATE "Variante" v SET "precoCentavos"=COALESCE(v."precoCentavos",p."precoCentavos"),
 "pesoKg"=COALESCE(v."pesoKg",p."pesoKg"),"alturaCm"=p."alturaCm","larguraCm"=p."larguraCm","comprimentoCm"=p."comprimentoCm",
 disponibilidade=p.disponibilidade, sku=nullif(v.sku,'')
FROM "Produto" p WHERE p.id=v."produtoId" AND NOT v.padrao;
INSERT INTO "PrecoVariante" ("tenantId","varianteId","valorCentavos","comparacaoCentavos")
SELECT v."tenantId",v.id,v."precoCentavos",CASE WHEN v.padrao THEN p."precoDeCentavos" ELSE NULL END
FROM "Variante" v JOIN "Produto" p ON p.id=v."produtoId";
INSERT INTO "SaldoEstoque" (id,"tenantId","varianteId",fisico)
SELECT 'se_'||md5(id),"tenantId",id,estoque FROM "Variante";
INSERT INTO "MidiaProduto" (id,"tenantId","produtoId",url,ordem,finalidade,origem,familia,fonte)
SELECT 'mi_'||md5(p.id||'|'||m.url),p."tenantId",p.id,m.url,m.ordem-1,
 CASE WHEN m.ordem=1 THEN 'principal' ELSE 'galeria' END,p."imagemOrigem",p."imagemFamilia",'migracao:Produto.imagens'
FROM "Produto" p CROSS JOIN LATERAL (SELECT url,min(n)::int ordem FROM unnest(p.imagens) WITH ORDINALITY x(url,n) WHERE nullif(trim(url),'') IS NOT NULL GROUP BY url) m;
INSERT INTO "MidiaProduto" (id,"tenantId","produtoId","varianteId",escopo,url,ordem,finalidade,fonte)
SELECT 'mi_'||md5(v.id||'|'||v.imagem),v."tenantId",v."produtoId",v.id,v.id,v.imagem,0,'principal','migracao:Variante.imagem'
FROM "Variante" v WHERE NOT v.padrao AND nullif(v.imagem,'') IS NOT NULL;
INSERT INTO "PublicacaoCanal" (id,"tenantId","varianteId",canal,"idExterno")
SELECT 'pc_'||md5(v.id||'google'),v."tenantId",v.id,'google',CASE WHEN v.padrao THEN v."produtoId" ELSE v."produtoId"||':'||v.id END FROM "Variante" v;

-- CreateIndex
CREATE UNIQUE INDEX "PrecoVariante_tenantId_varianteId_key" ON "PrecoVariante"("tenantId", "varianteId");

-- CreateIndex
CREATE UNIQUE INDEX "SaldoEstoque_tenantId_varianteId_local_key" ON "SaldoEstoque"("tenantId", "varianteId", "local");

-- CreateIndex
CREATE INDEX "ReservaEstoque_tenantId_estado_idx" ON "ReservaEstoque"("tenantId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "ReservaEstoque_tenantId_referencia_varianteId_key" ON "ReservaEstoque"("tenantId", "referencia", "varianteId");

-- CreateIndex
CREATE UNIQUE INDEX "TentativaCatalogo_tenantId_referencia_key" ON "TentativaCatalogo"("tenantId", "referencia");

-- CreateIndex
CREATE UNIQUE INDEX "MovimentoEstoque_tenantId_chave_key" ON "MovimentoEstoque"("tenantId", "chave");

-- CreateIndex
CREATE INDEX "MidiaProduto_tenantId_produtoId_ordem_idx" ON "MidiaProduto"("tenantId", "produtoId", "ordem");

-- CreateIndex
CREATE UNIQUE INDEX "MidiaProduto_produtoId_escopo_url_key" ON "MidiaProduto"("produtoId", "escopo", "url");
ALTER TABLE "MidiaProduto" ADD CONSTRAINT "MidiaProduto_escopo_valido" CHECK (escopo=coalesce("varianteId",'produto'));

-- CreateIndex
CREATE UNIQUE INDEX "PublicacaoCanal_tenantId_varianteId_canal_contaExterna_key" ON "PublicacaoCanal"("tenantId", "varianteId", "canal", "contaExterna");

-- CreateIndex
CREATE UNIQUE INDEX "PublicacaoCanal_tenantId_canal_contaExterna_idExterno_key" ON "PublicacaoCanal"("tenantId", "canal", "contaExterna", "idExterno");

-- CreateIndex
CREATE UNIQUE INDEX "HistoricoCatalogo_produtoId_versao_key" ON "HistoricoCatalogo"("produtoId", "versao");

-- CreateIndex
CREATE INDEX "EventoCatalogo_tenantId_processadoEm_criadoEm_idx" ON "EventoCatalogo"("tenantId", "processadoEm", "criadoEm");

-- CreateIndex
CREATE UNIQUE INDEX "EventoCatalogo_produtoId_versao_key" ON "EventoCatalogo"("produtoId", "versao");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_tenantId_id_key" ON "Produto"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Variante_tenantId_id_key" ON "Variante"("tenantId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Variante_tenantId_produtoId_id_key" ON "Variante"("tenantId", "produtoId", "id");

-- CreateIndex
CREATE UNIQUE INDEX "Variante_tenantId_sku_key" ON "Variante"("tenantId", "sku");

-- AddForeignKey
ALTER TABLE "Variante" ADD CONSTRAINT "Variante_tenantId_produtoId_fkey" FOREIGN KEY ("tenantId", "produtoId") REFERENCES "Produto"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PrecoVariante" ADD CONSTRAINT "PrecoVariante_tenantId_varianteId_fkey" FOREIGN KEY ("tenantId", "varianteId") REFERENCES "Variante"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaldoEstoque" ADD CONSTRAINT "SaldoEstoque_tenantId_varianteId_fkey" FOREIGN KEY ("tenantId", "varianteId") REFERENCES "Variante"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReservaEstoque" ADD CONSTRAINT "ReservaEstoque_tenantId_varianteId_fkey" FOREIGN KEY ("tenantId", "varianteId") REFERENCES "Variante"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MovimentoEstoque" ADD CONSTRAINT "MovimentoEstoque_tenantId_varianteId_fkey" FOREIGN KEY ("tenantId", "varianteId") REFERENCES "Variante"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MidiaProduto" ADD CONSTRAINT "MidiaProduto_tenantId_produtoId_fkey" FOREIGN KEY ("tenantId", "produtoId") REFERENCES "Produto"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MidiaProduto" ADD CONSTRAINT "MidiaProduto_tenantId_produtoId_varianteId_fkey" FOREIGN KEY ("tenantId", "produtoId", "varianteId") REFERENCES "Variante"("tenantId", "produtoId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PublicacaoCanal" ADD CONSTRAINT "PublicacaoCanal_tenantId_varianteId_fkey" FOREIGN KEY ("tenantId", "varianteId") REFERENCES "Variante"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HistoricoCatalogo" ADD CONSTRAINT "HistoricoCatalogo_tenantId_produtoId_fkey" FOREIGN KEY ("tenantId", "produtoId") REFERENCES "Produto"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Garantias do domínio; as tabelas legadas não são mais entradas comerciais.
CREATE UNIQUE INDEX "Variante_padrao_unica" ON "Variante"("produtoId") WHERE padrao;
CREATE UNIQUE INDEX "Variante_combinacao_ativa" ON "Variante"("produtoId",valores) WHERE ativo AND NOT padrao;
ALTER TABLE "PrecoVariante" ADD CONSTRAINT "PrecoVariante_valores_validos" CHECK (moeda='BRL' AND "valorCentavos">=0 AND ("comparacaoCentavos" IS NULL OR "comparacaoCentavos">=0));
ALTER TABLE "SaldoEstoque" ADD CONSTRAINT "SaldoEstoque_saldo_valido" CHECK (reservado>=0 AND (fisico IS NULL AND reservado=0 OR fisico>=reservado));
ALTER TABLE "ReservaEstoque" ADD CONSTRAINT "ReservaEstoque_quantidade_valida" CHECK (quantidade>0 AND estado IN ('ATIVA','CONFIRMADA','LIBERADA'));
ALTER TABLE "Variante" ADD CONSTRAINT "Variante_identificacao_valida" CHECK ("identificadoresEstado" IN ('desconhecido','informado','sem_identificador'));
ALTER TABLE "MidiaProduto" ADD CONSTRAINT "MidiaProduto_origem_valida" CHECK (origem IN ('propria','representativa','ilustracao') AND (origem<>'representativa' OR nullif(familia,'') IS NOT NULL));
ALTER TABLE "PublicacaoCanal" ADD CONSTRAINT "PublicacaoCanal_estados_validos" CHECK (
 "estadoEnvio" IN ('NAO_ENVIADO','ENVIADO','FALHOU') AND "resultadoExterno" IN ('NAO_CONSULTADO','PENDENTE','APROVADO','REPROVADO')
 AND ("resultadoExterno"='NAO_CONSULTADO' OR "consultadoEm" IS NOT NULL));

CREATE FUNCTION catalogo_proteger_projecao() RETURNS trigger AS $$
BEGIN
 IF current_setting('lojas.catalogo_escrita', true) IS DISTINCT FROM 'on' THEN
  IF TG_TABLE_NAME='Produto' AND (to_jsonb(NEW) - ARRAY['atualizadoEm','busca','nome','marca','descricaoCurta','descricao','destaque','ativo','categoriaId','slug','atributos','codigoOriginal','codigosEquivalentes','compatibilidade'])
      IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['atualizadoEm','busca','nome','marca','descricaoCurta','descricao','destaque','ativo','categoriaId','slug','atributos','codigoOriginal','codigosEquivalentes','compatibilidade']) THEN
    RAISE EXCEPTION 'Use a API do catálogo: os campos comerciais de Produto são projeções';
  END IF;
  IF TG_TABLE_NAME='Variante' AND (NEW."precoCentavos",NEW.estoque) IS DISTINCT FROM (OLD."precoCentavos",OLD.estoque) THEN
    RAISE EXCEPTION 'Use PrecoVariante e SaldoEstoque pela API do catálogo';
  END IF;
 END IF;
 RETURN NEW;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER catalogo_projecao_produto BEFORE UPDATE ON "Produto" FOR EACH ROW EXECUTE FUNCTION catalogo_proteger_projecao();
CREATE TRIGGER catalogo_projecao_variante BEFORE UPDATE ON "Variante" FOR EACH ROW EXECUTE FUNCTION catalogo_proteger_projecao();

-- Verificado no COMMIT: permite criar produto + variante na mesma transação.
CREATE FUNCTION catalogo_exigir_variante() RETURNS trigger AS $$
DECLARE produto_id text;
BEGIN
 IF TG_TABLE_NAME='Produto' THEN produto_id := NEW.id;
 ELSE produto_id := OLD."produtoId";
 END IF;
 IF EXISTS(SELECT 1 FROM "Produto" WHERE id=produto_id) AND NOT EXISTS(SELECT 1 FROM "Variante" WHERE "produtoId"=produto_id) THEN
  RAISE EXCEPTION 'Todo produto precisa de ao menos uma variante interna';
 END IF;
 RETURN NULL;
END $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER produto_com_variante AFTER INSERT ON "Produto" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION catalogo_exigir_variante();
CREATE CONSTRAINT TRIGGER variante_preservada AFTER DELETE ON "Variante" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION catalogo_exigir_variante();
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
    lower(concat_ws(' ', NEW."nome", NEW."marca", NEW."sku", NEW."gtin", NEW."descricaoCurta", NEW."codigoOriginal", array_to_string(NEW."codigosEquivalentes", ' '), motos, medidas, atributos, identificadores)),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Reindexa o que já existe (o gatilho dispara no UPDATE).
UPDATE "Produto" SET "nome" = "nome";

COMMIT;
