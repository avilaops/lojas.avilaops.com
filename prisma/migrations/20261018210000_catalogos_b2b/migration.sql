CREATE TYPE "EstadoVersaoCatalogoB2B" AS ENUM ('RASCUNHO', 'APROVADA');
CREATE TYPE "AcaoItemCatalogoB2B" AS ENUM ('INCLUIR', 'EXCLUIR');
CREATE TYPE "EstrategiaPrecoCatalogoB2B" AS ENUM ('FIXO', 'DESCONTO');

ALTER TABLE "Produto" ADD COLUMN "ncm" TEXT, ADD COLUMN "cest" TEXT;
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_ncm_cest_check" CHECK (
  ("ncm" IS NULL OR "ncm" ~ '^[0-9]{8}$') AND ("cest" IS NULL OR "cest" ~ '^[0-9]{7}$')
);

CREATE TABLE "CatalogoB2B" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "referencia" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CatalogoB2B_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "VersaoCatalogoB2B" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "catalogoId" TEXT NOT NULL,
  "versao" INTEGER NOT NULL,
  "estado" "EstadoVersaoCatalogoB2B" NOT NULL DEFAULT 'RASCUNHO',
  "moeda" TEXT NOT NULL DEFAULT 'BRL',
  "vigenteDesde" TIMESTAMP(3) NOT NULL,
  "vigenteAte" TIMESTAMP(3),
  "aprovadoEm" TIMESTAMP(3),
  "aprovadoPor" TEXT,
  "conteudoHash" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VersaoCatalogoB2B_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VersaoCatalogoB2B_dados_check" CHECK (
    "versao" > 0 AND "moeda" = 'BRL' AND
    ("vigenteAte" IS NULL OR "vigenteAte" > "vigenteDesde") AND
    (("estado" = 'RASCUNHO' AND "aprovadoEm" IS NULL AND "aprovadoPor" IS NULL AND "conteudoHash" IS NULL) OR
     ("estado" = 'APROVADA' AND "aprovadoEm" IS NOT NULL AND length("aprovadoPor") > 0 AND "conteudoHash" ~ '^[0-9a-f]{64}$'))
  )
);

CREATE TABLE "AtribuicaoCatalogoB2B" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "versaoId" TEXT NOT NULL,
  "empresaId" TEXT NOT NULL,
  "unidadeId" TEXT,
  "prioridade" INTEGER NOT NULL DEFAULT 0,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AtribuicaoCatalogoB2B_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AtribuicaoCatalogoB2B_prioridade_check" CHECK ("prioridade" >= 0)
);

CREATE TABLE "ItemCatalogoB2B" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "versaoId" TEXT NOT NULL,
  "produtoId" TEXT NOT NULL,
  "varianteId" TEXT,
  "acao" "AcaoItemCatalogoB2B" NOT NULL,
  "estrategiaPreco" "EstrategiaPrecoCatalogoB2B" NOT NULL,
  "precoFixoCentavos" INTEGER,
  "descontoPontosBase" INTEGER,
  "quantidadeMinima" INTEGER NOT NULL,
  "quantidadeMaxima" INTEGER,
  "multiploVenda" INTEGER NOT NULL,
  "quantidadePorEmbalagem" INTEGER NOT NULL,
  "unidadeComercial" TEXT NOT NULL,
  "unidadesBaseNumerador" INTEGER NOT NULL,
  "unidadesBaseDenominador" INTEGER NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ItemCatalogoB2B_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ItemCatalogoB2B_quantidades_check" CHECK (
    "quantidadeMinima" > 0 AND ("quantidadeMaxima" IS NULL OR "quantidadeMaxima" >= "quantidadeMinima") AND
    "multiploVenda" > 0 AND "quantidadePorEmbalagem" > 0 AND
    "unidadesBaseNumerador" > 0 AND "unidadesBaseDenominador" > 0 AND length("unidadeComercial") > 0
  ),
  CONSTRAINT "ItemCatalogoB2B_preco_check" CHECK (
    ("acao" = 'EXCLUIR' AND "precoFixoCentavos" IS NULL AND "descontoPontosBase" IS NULL) OR
    ("acao" = 'INCLUIR' AND "estrategiaPreco" = 'FIXO' AND "precoFixoCentavos" >= 0 AND "descontoPontosBase" IS NULL) OR
    ("acao" = 'INCLUIR' AND "estrategiaPreco" = 'DESCONTO' AND "precoFixoCentavos" IS NULL AND "descontoPontosBase" BETWEEN 0 AND 10000)
  )
);

CREATE TABLE "ComponenteKitCatalogoB2B" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "varianteId" TEXT NOT NULL,
  "quantidadeBaseNumerador" INTEGER NOT NULL,
  "quantidadeBaseDenominador" INTEGER NOT NULL,
  CONSTRAINT "ComponenteKitCatalogoB2B_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ComponenteKitCatalogoB2B_quantidade_check" CHECK ("quantidadeBaseNumerador" > 0 AND "quantidadeBaseDenominador" > 0)
);

CREATE TABLE "AuditoriaCatalogoB2B" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "catalogoId" TEXT NOT NULL,
  "versaoId" TEXT NOT NULL,
  "acao" TEXT NOT NULL,
  "ator" TEXT NOT NULL,
  "conteudoHash" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditoriaCatalogoB2B_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AuditoriaCatalogoB2B_dados_check" CHECK (length("acao") > 0 AND length("ator") > 0 AND "conteudoHash" ~ '^[0-9a-f]{64}$')
);

CREATE UNIQUE INDEX "CatalogoB2B_tenantId_referencia_key" ON "CatalogoB2B"("tenantId", "referencia");
CREATE UNIQUE INDEX "CatalogoB2B_tenantId_id_key" ON "CatalogoB2B"("tenantId", "id");
CREATE UNIQUE INDEX "VersaoCatalogoB2B_tenantId_catalogoId_versao_key" ON "VersaoCatalogoB2B"("tenantId", "catalogoId", "versao");
CREATE UNIQUE INDEX "VersaoCatalogoB2B_tenantId_id_key" ON "VersaoCatalogoB2B"("tenantId", "id");
CREATE INDEX "VersaoCatalogoB2B_tenantId_estado_vigenteDesde_vigenteAte_idx" ON "VersaoCatalogoB2B"("tenantId", "estado", "vigenteDesde", "vigenteAte");
CREATE UNIQUE INDEX "AtribuicaoCatalogoB2B_tenantId_id_key" ON "AtribuicaoCatalogoB2B"("tenantId", "id");
CREATE UNIQUE INDEX "AtribuicaoCatalogoB2B_empresa_key" ON "AtribuicaoCatalogoB2B"("tenantId", "versaoId", "empresaId") WHERE "unidadeId" IS NULL;
CREATE UNIQUE INDEX "AtribuicaoCatalogoB2B_unidade_key" ON "AtribuicaoCatalogoB2B"("tenantId", "versaoId", "empresaId", "unidadeId") WHERE "unidadeId" IS NOT NULL;
CREATE INDEX "AtribuicaoCatalogoB2B_tenantId_empresaId_unidadeId_priorida_idx" ON "AtribuicaoCatalogoB2B"("tenantId", "empresaId", "unidadeId", "prioridade");
CREATE UNIQUE INDEX "ItemCatalogoB2B_tenantId_id_key" ON "ItemCatalogoB2B"("tenantId", "id");
CREATE INDEX "ItemCatalogoB2B_tenantId_versaoId_produtoId_varianteId_idx" ON "ItemCatalogoB2B"("tenantId", "versaoId", "produtoId", "varianteId");
CREATE UNIQUE INDEX "ComponenteKitCatalogoB2B_tenantId_itemId_varianteId_key" ON "ComponenteKitCatalogoB2B"("tenantId", "itemId", "varianteId");
CREATE INDEX "ComponenteKitCatalogoB2B_tenantId_varianteId_idx" ON "ComponenteKitCatalogoB2B"("tenantId", "varianteId");
CREATE INDEX "AuditoriaCatalogoB2B_tenantId_catalogoId_criadoEm_idx" ON "AuditoriaCatalogoB2B"("tenantId", "catalogoId", "criadoEm");
CREATE INDEX "AuditoriaCatalogoB2B_tenantId_versaoId_idx" ON "AuditoriaCatalogoB2B"("tenantId", "versaoId");

ALTER TABLE "CatalogoB2B" ADD CONSTRAINT "CatalogoB2B_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VersaoCatalogoB2B" ADD CONSTRAINT "VersaoCatalogoB2B_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VersaoCatalogoB2B" ADD CONSTRAINT "VersaoCatalogoB2B_tenantId_catalogoId_fkey" FOREIGN KEY ("tenantId", "catalogoId") REFERENCES "CatalogoB2B"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AtribuicaoCatalogoB2B" ADD CONSTRAINT "AtribuicaoCatalogoB2B_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AtribuicaoCatalogoB2B" ADD CONSTRAINT "AtribuicaoCatalogoB2B_tenantId_versaoId_fkey" FOREIGN KEY ("tenantId", "versaoId") REFERENCES "VersaoCatalogoB2B"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AtribuicaoCatalogoB2B" ADD CONSTRAINT "AtribuicaoCatalogoB2B_tenantId_empresaId_fkey" FOREIGN KEY ("tenantId", "empresaId") REFERENCES "EmpresaB2B"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AtribuicaoCatalogoB2B" ADD CONSTRAINT "AtribuicaoCatalogoB2B_tenantId_empresaId_unidadeId_fkey" FOREIGN KEY ("tenantId", "empresaId", "unidadeId") REFERENCES "UnidadeEmpresaB2B"("tenantId", "empresaId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemCatalogoB2B" ADD CONSTRAINT "ItemCatalogoB2B_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemCatalogoB2B" ADD CONSTRAINT "ItemCatalogoB2B_tenantId_versaoId_fkey" FOREIGN KEY ("tenantId", "versaoId") REFERENCES "VersaoCatalogoB2B"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemCatalogoB2B" ADD CONSTRAINT "ItemCatalogoB2B_tenantId_produtoId_fkey" FOREIGN KEY ("tenantId", "produtoId") REFERENCES "Produto"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ItemCatalogoB2B" ADD CONSTRAINT "ItemCatalogoB2B_tenantId_produtoId_varianteId_fkey" FOREIGN KEY ("tenantId", "produtoId", "varianteId") REFERENCES "Variante"("tenantId", "produtoId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ComponenteKitCatalogoB2B" ADD CONSTRAINT "ComponenteKitCatalogoB2B_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComponenteKitCatalogoB2B" ADD CONSTRAINT "ComponenteKitCatalogoB2B_tenantId_itemId_fkey" FOREIGN KEY ("tenantId", "itemId") REFERENCES "ItemCatalogoB2B"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ComponenteKitCatalogoB2B" ADD CONSTRAINT "ComponenteKitCatalogoB2B_tenantId_varianteId_fkey" FOREIGN KEY ("tenantId", "varianteId") REFERENCES "Variante"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditoriaCatalogoB2B" ADD CONSTRAINT "AuditoriaCatalogoB2B_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditoriaCatalogoB2B" ADD CONSTRAINT "AuditoriaCatalogoB2B_tenantId_catalogoId_fkey" FOREIGN KEY ("tenantId", "catalogoId") REFERENCES "CatalogoB2B"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditoriaCatalogoB2B" ADD CONSTRAINT "AuditoriaCatalogoB2B_tenantId_versaoId_fkey" FOREIGN KEY ("tenantId", "versaoId") REFERENCES "VersaoCatalogoB2B"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION impedir_mutacao_versao_catalogo_b2b() RETURNS trigger AS $$
BEGIN
  IF OLD."estado" = 'APROVADA' THEN RAISE EXCEPTION 'VersaoCatalogoB2B aprovada é imutável'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "VersaoCatalogoB2B_imutavel" BEFORE UPDATE OR DELETE ON "VersaoCatalogoB2B" FOR EACH ROW EXECUTE FUNCTION impedir_mutacao_versao_catalogo_b2b();

CREATE FUNCTION impedir_mutacao_filho_catalogo_b2b() RETURNS trigger AS $$
DECLARE versao_antiga TEXT; versao_nova TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN versao_antiga := OLD."versaoId"; END IF;
  IF TG_OP <> 'DELETE' THEN versao_nova := NEW."versaoId"; END IF;
  IF EXISTS (
    SELECT 1 FROM "VersaoCatalogoB2B" v
    WHERE v."id" IN (versao_antiga, versao_nova) AND v."estado" = 'APROVADA'
  ) THEN
    RAISE EXCEPTION 'VersaoCatalogoB2B aprovada é imutável';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AtribuicaoCatalogoB2B_imutavel" BEFORE INSERT OR UPDATE OR DELETE ON "AtribuicaoCatalogoB2B" FOR EACH ROW EXECUTE FUNCTION impedir_mutacao_filho_catalogo_b2b();
CREATE TRIGGER "ItemCatalogoB2B_imutavel" BEFORE INSERT OR UPDATE OR DELETE ON "ItemCatalogoB2B" FOR EACH ROW EXECUTE FUNCTION impedir_mutacao_filho_catalogo_b2b();

CREATE FUNCTION impedir_mutacao_componente_catalogo_b2b() RETURNS trigger AS $$
DECLARE item_antigo TEXT; item_novo TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN item_antigo := OLD."itemId"; END IF;
  IF TG_OP <> 'DELETE' THEN item_novo := NEW."itemId"; END IF;
  IF EXISTS (
    SELECT 1
    FROM "ItemCatalogoB2B" i
    JOIN "VersaoCatalogoB2B" v ON v."id" = i."versaoId"
    WHERE i."id" IN (item_antigo, item_novo) AND v."estado" = 'APROVADA'
  ) THEN
    RAISE EXCEPTION 'VersaoCatalogoB2B aprovada é imutável';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "ComponenteKitCatalogoB2B_imutavel" BEFORE INSERT OR UPDATE OR DELETE ON "ComponenteKitCatalogoB2B" FOR EACH ROW EXECUTE FUNCTION impedir_mutacao_componente_catalogo_b2b();

CREATE FUNCTION impedir_mutacao_auditoria_catalogo_b2b() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditoriaCatalogoB2B é append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AuditoriaCatalogoB2B_append_only" BEFORE UPDATE OR DELETE ON "AuditoriaCatalogoB2B" FOR EACH ROW EXECUTE FUNCTION impedir_mutacao_auditoria_catalogo_b2b();
