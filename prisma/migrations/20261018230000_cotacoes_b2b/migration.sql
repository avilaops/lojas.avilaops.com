CREATE TYPE "EstadoCotacaoB2B" AS ENUM ('RASCUNHO', 'EM_NEGOCIACAO', 'AGUARDANDO_APROVACAO', 'APROVADA', 'RECUSADA', 'EXPIRADA', 'CANCELADA', 'CONVERTIDA');

ALTER TABLE "Pedido"
  ADD COLUMN "pedidoCompra" TEXT,
  ADD COLUMN "empresaB2BId" TEXT,
  ADD COLUMN "centroCustoB2BId" TEXT,
  ADD COLUMN "cotacaoVersao" INTEGER,
  ADD COLUMN "condicoesComerciais" JSONB;

CREATE TABLE "CotacaoB2B" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "empresaId" TEXT NOT NULL, "unidadeId" TEXT,
  "compradorEmpresaId" TEXT, "centroCustoId" TEXT, "pedidoCompra" TEXT, "referencia" TEXT NOT NULL,
  "estado" "EstadoCotacaoB2B" NOT NULL DEFAULT 'RASCUNHO', "versaoAtual" INTEGER NOT NULL DEFAULT 1,
  "versaoAprovada" INTEGER, "aprovadaEm" TIMESTAMP(3), "aprovadaPor" TEXT, "aprovacaoExcecao" BOOLEAN NOT NULL DEFAULT false,
  "aprovacaoJustificativa" TEXT, "responsavelEmail" TEXT NOT NULL, "validaAte" TIMESTAMP(3) NOT NULL,
  "pedidoId" TEXT, "chaveConversao" TEXT, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm" TIMESTAMP(3) NOT NULL, CONSTRAINT "CotacaoB2B_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CotacaoB2B_dados_check" CHECK ("versaoAtual" > 0 AND ("versaoAprovada" IS NULL OR "versaoAprovada" > 0) AND length("responsavelEmail") > 0)
);
CREATE TABLE "VersaoCotacaoB2B" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "cotacaoId" TEXT NOT NULL, "numero" INTEGER NOT NULL,
  "autorTipo" TEXT NOT NULL, "autorId" TEXT, "autorEmail" TEXT, "itens" JSONB NOT NULL,
  "subtotalCentavos" INTEGER NOT NULL, "descontoCentavos" INTEGER NOT NULL DEFAULT 0,
  "freteCentavos" INTEGER NOT NULL DEFAULT 0, "totalCentavos" INTEGER NOT NULL, "condicoes" JSONB NOT NULL DEFAULT '{}',
  "justificativa" TEXT, "excecaoComercial" BOOLEAN NOT NULL DEFAULT false,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VersaoCotacaoB2B_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "VersaoCotacaoB2B_valores_check" CHECK ("numero" > 0 AND "subtotalCentavos" >= 0 AND "descontoCentavos" >= 0 AND "freteCentavos" >= 0 AND "totalCentavos" = "subtotalCentavos" - "descontoCentavos" + "freteCentavos")
);
CREATE TABLE "EventoCotacaoB2B" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "cotacaoId" TEXT NOT NULL, "tipo" TEXT NOT NULL,
  "atorTipo" TEXT NOT NULL, "atorId" TEXT, "atorEmail" TEXT, "dados" JSONB NOT NULL DEFAULT '{}',
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "EventoCotacaoB2B_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "AnexoCotacaoB2B" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "cotacaoId" TEXT NOT NULL, "nome" TEXT NOT NULL,
  "url" TEXT NOT NULL, "tipoMime" TEXT NOT NULL, "tamanhoBytes" INTEGER NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "AnexoCotacaoB2B_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AnexoCotacaoB2B_dados_check" CHECK (length("nome") > 0 AND length("url") > 0 AND length("tipoMime") > 0 AND "tamanhoBytes" >= 0)
);

CREATE UNIQUE INDEX "CotacaoB2B_tenantId_referencia_key" ON "CotacaoB2B"("tenantId", "referencia");
CREATE UNIQUE INDEX "CotacaoB2B_tenantId_id_key" ON "CotacaoB2B"("tenantId", "id");
CREATE UNIQUE INDEX "CotacaoB2B_tenantId_pedidoId_key" ON "CotacaoB2B"("tenantId", "pedidoId");
CREATE UNIQUE INDEX "CotacaoB2B_tenantId_chaveConversao_key" ON "CotacaoB2B"("tenantId", "chaveConversao");
CREATE INDEX "CotacaoB2B_tenantId_empresaId_estado_criadoEm_idx" ON "CotacaoB2B"("tenantId", "empresaId", "estado", "criadoEm");
CREATE UNIQUE INDEX "VersaoCotacaoB2B_tenantId_cotacaoId_numero_key" ON "VersaoCotacaoB2B"("tenantId", "cotacaoId", "numero");
CREATE UNIQUE INDEX "VersaoCotacaoB2B_tenantId_id_key" ON "VersaoCotacaoB2B"("tenantId", "id");
CREATE INDEX "VersaoCotacaoB2B_tenantId_cotacaoId_idx" ON "VersaoCotacaoB2B"("tenantId", "cotacaoId");
CREATE INDEX "EventoCotacaoB2B_tenantId_cotacaoId_criadoEm_idx" ON "EventoCotacaoB2B"("tenantId", "cotacaoId", "criadoEm");
CREATE INDEX "AnexoCotacaoB2B_tenantId_cotacaoId_idx" ON "AnexoCotacaoB2B"("tenantId", "cotacaoId");
CREATE UNIQUE INDEX "Pedido_tenantId_id_key" ON "Pedido"("tenantId", "id");
CREATE INDEX "Pedido_tenantId_empresaB2BId_centroCustoB2BId_idx" ON "Pedido"("tenantId", "empresaB2BId", "centroCustoB2BId");

ALTER TABLE "CotacaoB2B" ADD CONSTRAINT "CotacaoB2B_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CotacaoB2B" ADD CONSTRAINT "CotacaoB2B_empresa_fkey" FOREIGN KEY ("tenantId", "empresaId") REFERENCES "EmpresaB2B"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CotacaoB2B" ADD CONSTRAINT "CotacaoB2B_unidade_fkey" FOREIGN KEY ("tenantId", "empresaId", "unidadeId") REFERENCES "UnidadeEmpresaB2B"("tenantId", "empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CotacaoB2B" ADD CONSTRAINT "CotacaoB2B_comprador_fkey" FOREIGN KEY ("tenantId", "empresaId", "compradorEmpresaId") REFERENCES "CompradorEmpresaB2B"("tenantId", "empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CotacaoB2B" ADD CONSTRAINT "CotacaoB2B_centro_fkey" FOREIGN KEY ("tenantId", "empresaId", "centroCustoId") REFERENCES "CentroCustoB2B"("tenantId", "empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CotacaoB2B" ADD CONSTRAINT "CotacaoB2B_pedidoId_fkey" FOREIGN KEY ("tenantId", "pedidoId") REFERENCES "Pedido"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "VersaoCotacaoB2B" ADD CONSTRAINT "VersaoCotacaoB2B_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VersaoCotacaoB2B" ADD CONSTRAINT "VersaoCotacaoB2B_cotacao_fkey" FOREIGN KEY ("tenantId", "cotacaoId") REFERENCES "CotacaoB2B"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventoCotacaoB2B" ADD CONSTRAINT "EventoCotacaoB2B_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventoCotacaoB2B" ADD CONSTRAINT "EventoCotacaoB2B_cotacao_fkey" FOREIGN KEY ("tenantId", "cotacaoId") REFERENCES "CotacaoB2B"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AnexoCotacaoB2B" ADD CONSTRAINT "AnexoCotacaoB2B_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnexoCotacaoB2B" ADD CONSTRAINT "AnexoCotacaoB2B_cotacao_fkey" FOREIGN KEY ("tenantId", "cotacaoId") REFERENCES "CotacaoB2B"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_empresaB2B_fkey" FOREIGN KEY ("tenantId", "empresaB2BId") REFERENCES "EmpresaB2B"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_centroCustoB2B_fkey" FOREIGN KEY ("tenantId", "empresaB2BId", "centroCustoB2BId") REFERENCES "CentroCustoB2B"("tenantId", "empresaId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION impedir_mutacao_versao_cotacao_b2b() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'VersaoCotacaoB2B é imutável'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "VersaoCotacaoB2B_imutavel" BEFORE UPDATE OR DELETE ON "VersaoCotacaoB2B" FOR EACH ROW EXECUTE FUNCTION impedir_mutacao_versao_cotacao_b2b();
CREATE FUNCTION impedir_mutacao_evento_cotacao_b2b() RETURNS trigger AS $$ BEGIN RAISE EXCEPTION 'EventoCotacaoB2B é append-only'; END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "EventoCotacaoB2B_append_only" BEFORE UPDATE OR DELETE ON "EventoCotacaoB2B" FOR EACH ROW EXECUTE FUNCTION impedir_mutacao_evento_cotacao_b2b();
