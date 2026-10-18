CREATE TYPE "SituacaoEmpresaB2B" AS ENUM ('ATIVA', 'SUSPENSA');
CREATE TYPE "SituacaoCompradorB2B" AS ENUM ('ATIVO', 'SUSPENSO', 'REVOGADO');
CREATE TYPE "EscopoAutorizacaoB2B" AS ENUM ('ORGANIZACAO', 'UNIDADE');
CREATE TYPE "PapelCorporativoB2B" AS ENUM ('ADMINISTRADOR', 'COMPRADOR', 'APROVADOR', 'FINANCEIRO', 'VENDEDOR');
CREATE TYPE "SituacaoProvisionamentoB2B" AS ENUM ('PENDENTE', 'PROCESSANDO', 'SINCRONIZADO', 'FALHOU', 'SUSPENSO', 'REVOGADO');

CREATE UNIQUE INDEX "Comprador_tenantId_id_key" ON "Comprador"("tenantId", "id");

CREATE TABLE "EmpresaB2B" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "razaoSocial" TEXT NOT NULL,
    "nomeFantasia" TEXT,
    "authOrganizacaoId" TEXT,
    "situacao" "SituacaoEmpresaB2B" NOT NULL DEFAULT 'ATIVA',
    "versao" INTEGER NOT NULL DEFAULT 1,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmpresaB2B_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EmpresaB2B_versao_check" CHECK ("versao" > 0)
);

CREATE TABLE "UnidadeEmpresaB2B" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cnpj" TEXT NOT NULL,
    "inscricaoEstadual" TEXT,
    "authUnidadeId" TEXT,
    "ativa" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "UnidadeEmpresaB2B_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UnidadeEmpresaB2B_cnpj_check" CHECK ("cnpj" ~ '^[0-9]{14}$')
);

CREATE TABLE "EnderecoUnidadeEmpresaB2B" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "unidadeId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "cep" TEXT NOT NULL,
    "logradouro" TEXT NOT NULL,
    "numero" TEXT NOT NULL,
    "complemento" TEXT,
    "bairro" TEXT NOT NULL,
    "cidade" TEXT NOT NULL,
    "uf" TEXT NOT NULL,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "EnderecoUnidadeEmpresaB2B_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ContatoEmpresaB2B" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "unidadeId" TEXT,
    "tipo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cargo" TEXT,
    "email" TEXT,
    "telefone" TEXT,
    "principal" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContatoEmpresaB2B_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompradorEmpresaB2B" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "compradorId" TEXT,
    "nome" TEXT NOT NULL,
    "emailNormalizado" TEXT NOT NULL,
    "authVinculoId" TEXT,
    "situacao" "SituacaoCompradorB2B" NOT NULL DEFAULT 'ATIVO',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompradorEmpresaB2B_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutorizacaoDesejadaB2B" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "compradorEmpresaId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "papel" "PapelCorporativoB2B" NOT NULL,
    "escopo" "EscopoAutorizacaoB2B" NOT NULL,
    "unidadeId" TEXT,
    "limiteAprovacaoCentavos" INTEGER,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutorizacaoDesejadaB2B_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "AutorizacaoDesejadaB2B_versao_check" CHECK ("versao" > 0),
    CONSTRAINT "AutorizacaoDesejadaB2B_limite_check" CHECK ("limiteAprovacaoCentavos" IS NULL OR "limiteAprovacaoCentavos" >= 0),
    CONSTRAINT "AutorizacaoDesejadaB2B_escopo_check" CHECK (("escopo" = 'ORGANIZACAO' AND "unidadeId" IS NULL) OR ("escopo" = 'UNIDADE' AND "unidadeId" IS NOT NULL))
);

CREATE TABLE "ProvisionamentoCompradorB2B" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "compradorEmpresaId" TEXT NOT NULL,
    "situacao" "SituacaoProvisionamentoB2B" NOT NULL DEFAULT 'PENDENTE',
    "versaoDesejada" INTEGER NOT NULL,
    "versaoSincronizada" INTEGER,
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "correlacaoId" TEXT NOT NULL,
    "intencaoHash" TEXT NOT NULL,
    "leaseId" TEXT,
    "ultimoErro" TEXT,
    "ultimaTentativaEm" TIMESTAMP(3),
    "sincronizadoEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProvisionamentoCompradorB2B_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ProvisionamentoCompradorB2B_versoes_check" CHECK ("versaoDesejada" > 0 AND ("versaoSincronizada" IS NULL OR "versaoSincronizada" > 0)),
    CONSTRAINT "ProvisionamentoCompradorB2B_tentativas_check" CHECK ("tentativas" >= 0)
);

CREATE TABLE "EscopoCompradorB2B" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "compradorEmpresaId" TEXT NOT NULL,
    "papel" "PapelCorporativoB2B" NOT NULL,
    "escopo" "EscopoAutorizacaoB2B" NOT NULL,
    "unidadeId" TEXT,
    "limiteAprovacaoCentavos" INTEGER,
    "contextoVersao" INTEGER NOT NULL,
    "reconciliadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EscopoCompradorB2B_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EscopoCompradorB2B_versao_check" CHECK ("contextoVersao" > 0),
    CONSTRAINT "EscopoCompradorB2B_limite_check" CHECK ("limiteAprovacaoCentavos" IS NULL OR "limiteAprovacaoCentavos" >= 0),
    CONSTRAINT "EscopoCompradorB2B_escopo_check" CHECK (("escopo" = 'ORGANIZACAO' AND "unidadeId" IS NULL) OR ("escopo" = 'UNIDADE' AND "unidadeId" IS NOT NULL))
);

CREATE TABLE "CentroCustoB2B" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "codigo" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "orcamentoMensalCentavos" INTEGER NOT NULL DEFAULT 0,
    "consumidoMesCentavos" INTEGER NOT NULL DEFAULT 0,
    "periodo" TEXT NOT NULL DEFAULT 'MENSAL',
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CentroCustoB2B_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CentroCustoB2B_valores_check" CHECK ("orcamentoMensalCentavos" >= 0 AND "consumidoMesCentavos" >= 0),
    CONSTRAINT "CentroCustoB2B_periodo_check" CHECK ("periodo" = 'MENSAL')
);

CREATE TABLE "CompradorCentroCustoB2B" (
    "tenantId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "compradorEmpresaId" TEXT NOT NULL,
    "centroCustoId" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CompradorCentroCustoB2B_pkey" PRIMARY KEY ("tenantId", "compradorEmpresaId", "centroCustoId")
);

CREATE TABLE "AuditoriaB2B" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "empresaId" TEXT NOT NULL,
    "tipoAtor" TEXT NOT NULL,
    "atorId" TEXT,
    "atorEmail" TEXT,
    "acao" TEXT NOT NULL,
    "entidade" TEXT NOT NULL,
    "entidadeId" TEXT NOT NULL,
    "resultado" TEXT NOT NULL,
    "correlacaoId" TEXT,
    "estadoAnterior" JSONB,
    "estadoPosterior" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditoriaB2B_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmpresaB2B_tenantId_situacao_idx" ON "EmpresaB2B"("tenantId", "situacao");
CREATE UNIQUE INDEX "EmpresaB2B_tenantId_referencia_key" ON "EmpresaB2B"("tenantId", "referencia");
CREATE UNIQUE INDEX "EmpresaB2B_tenantId_id_key" ON "EmpresaB2B"("tenantId", "id");
CREATE UNIQUE INDEX "EmpresaB2B_tenantId_authOrganizacaoId_key" ON "EmpresaB2B"("tenantId", "authOrganizacaoId");
CREATE INDEX "UnidadeEmpresaB2B_tenantId_empresaId_ativa_idx" ON "UnidadeEmpresaB2B"("tenantId", "empresaId", "ativa");
CREATE UNIQUE INDEX "UnidadeEmpresaB2B_tenantId_empresaId_referencia_key" ON "UnidadeEmpresaB2B"("tenantId", "empresaId", "referencia");
CREATE UNIQUE INDEX "UnidadeEmpresaB2B_tenantId_cnpj_key" ON "UnidadeEmpresaB2B"("tenantId", "cnpj");
CREATE UNIQUE INDEX "UnidadeEmpresaB2B_tenantId_authUnidadeId_key" ON "UnidadeEmpresaB2B"("tenantId", "authUnidadeId");
CREATE UNIQUE INDEX "UnidadeEmpresaB2B_tenantId_id_key" ON "UnidadeEmpresaB2B"("tenantId", "id");
CREATE UNIQUE INDEX "UnidadeEmpresaB2B_tenantId_empresaId_id_key" ON "UnidadeEmpresaB2B"("tenantId", "empresaId", "id");
CREATE INDEX "EnderecoUnidadeEmpresaB2B_tenantId_unidadeId_idx" ON "EnderecoUnidadeEmpresaB2B"("tenantId", "unidadeId");
CREATE INDEX "ContatoEmpresaB2B_tenantId_empresaId_idx" ON "ContatoEmpresaB2B"("tenantId", "empresaId");
CREATE INDEX "ContatoEmpresaB2B_tenantId_unidadeId_idx" ON "ContatoEmpresaB2B"("tenantId", "unidadeId");
CREATE INDEX "CompradorEmpresaB2B_tenantId_empresaId_situacao_idx" ON "CompradorEmpresaB2B"("tenantId", "empresaId", "situacao");
CREATE UNIQUE INDEX "CompradorEmpresaB2B_tenantId_empresaId_emailNormalizado_key" ON "CompradorEmpresaB2B"("tenantId", "empresaId", "emailNormalizado");
CREATE UNIQUE INDEX "CompradorEmpresaB2B_tenantId_authVinculoId_key" ON "CompradorEmpresaB2B"("tenantId", "authVinculoId");
CREATE UNIQUE INDEX "CompradorEmpresaB2B_tenantId_id_key" ON "CompradorEmpresaB2B"("tenantId", "id");
CREATE UNIQUE INDEX "CompradorEmpresaB2B_tenantId_empresaId_id_key" ON "CompradorEmpresaB2B"("tenantId", "empresaId", "id");
CREATE INDEX "AutorizacaoDesejadaB2B_tenantId_compradorEmpresaId_versao_idx" ON "AutorizacaoDesejadaB2B"("tenantId", "compradorEmpresaId", "versao");
CREATE UNIQUE INDEX "AutorizacaoDesejadaB2B_tenantId_compradorEmpresaId_versao_p_key" ON "AutorizacaoDesejadaB2B"("tenantId", "compradorEmpresaId", "versao", "papel", "escopo", "unidadeId");
CREATE UNIQUE INDEX "AutorizacaoDesejadaB2B_organizacao_key" ON "AutorizacaoDesejadaB2B"("tenantId", "compradorEmpresaId", "versao", "papel") WHERE "escopo" = 'ORGANIZACAO';
CREATE UNIQUE INDEX "ProvisionamentoCompradorB2B_compradorEmpresaId_key" ON "ProvisionamentoCompradorB2B"("compradorEmpresaId");
CREATE UNIQUE INDEX "ProvisionamentoCompradorB2B_correlacaoId_key" ON "ProvisionamentoCompradorB2B"("correlacaoId");
CREATE UNIQUE INDEX "ProvisionamentoCompradorB2B_leaseId_key" ON "ProvisionamentoCompradorB2B"("leaseId");
CREATE INDEX "ProvisionamentoCompradorB2B_situacao_atualizadoEm_idx" ON "ProvisionamentoCompradorB2B"("situacao", "atualizadoEm");
CREATE UNIQUE INDEX "ProvisionamentoCompradorB2B_tenantId_compradorEmpresaId_key" ON "ProvisionamentoCompradorB2B"("tenantId", "compradorEmpresaId");
CREATE INDEX "EscopoCompradorB2B_tenantId_compradorEmpresaId_idx" ON "EscopoCompradorB2B"("tenantId", "compradorEmpresaId");
CREATE UNIQUE INDEX "EscopoCompradorB2B_tenantId_compradorEmpresaId_papel_escopo_key" ON "EscopoCompradorB2B"("tenantId", "compradorEmpresaId", "papel", "escopo", "unidadeId");
CREATE UNIQUE INDEX "EscopoCompradorB2B_organizacao_key" ON "EscopoCompradorB2B"("tenantId", "compradorEmpresaId", "papel") WHERE "escopo" = 'ORGANIZACAO';
CREATE INDEX "CentroCustoB2B_tenantId_empresaId_ativo_idx" ON "CentroCustoB2B"("tenantId", "empresaId", "ativo");
CREATE UNIQUE INDEX "CentroCustoB2B_tenantId_empresaId_codigo_key" ON "CentroCustoB2B"("tenantId", "empresaId", "codigo");
CREATE UNIQUE INDEX "CentroCustoB2B_tenantId_id_key" ON "CentroCustoB2B"("tenantId", "id");
CREATE UNIQUE INDEX "CentroCustoB2B_tenantId_empresaId_id_key" ON "CentroCustoB2B"("tenantId", "empresaId", "id");
CREATE INDEX "CompradorCentroCustoB2B_tenantId_centroCustoId_idx" ON "CompradorCentroCustoB2B"("tenantId", "centroCustoId");
CREATE INDEX "AuditoriaB2B_tenantId_empresaId_criadoEm_idx" ON "AuditoriaB2B"("tenantId", "empresaId", "criadoEm");
CREATE INDEX "AuditoriaB2B_tenantId_entidade_entidadeId_idx" ON "AuditoriaB2B"("tenantId", "entidade", "entidadeId");
CREATE INDEX "AuditoriaB2B_correlacaoId_idx" ON "AuditoriaB2B"("correlacaoId");

ALTER TABLE "EmpresaB2B" ADD CONSTRAINT "EmpresaB2B_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnidadeEmpresaB2B" ADD CONSTRAINT "UnidadeEmpresaB2B_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UnidadeEmpresaB2B" ADD CONSTRAINT "UnidadeEmpresaB2B_tenantId_empresaId_fkey" FOREIGN KEY ("tenantId", "empresaId") REFERENCES "EmpresaB2B"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnderecoUnidadeEmpresaB2B" ADD CONSTRAINT "EnderecoUnidadeEmpresaB2B_tenantId_unidadeId_fkey" FOREIGN KEY ("tenantId", "unidadeId") REFERENCES "UnidadeEmpresaB2B"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContatoEmpresaB2B" ADD CONSTRAINT "ContatoEmpresaB2B_tenantId_empresaId_fkey" FOREIGN KEY ("tenantId", "empresaId") REFERENCES "EmpresaB2B"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContatoEmpresaB2B" ADD CONSTRAINT "ContatoEmpresaB2B_empresa_unidade_fkey" FOREIGN KEY ("tenantId", "empresaId", "unidadeId") REFERENCES "UnidadeEmpresaB2B"("tenantId", "empresaId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompradorEmpresaB2B" ADD CONSTRAINT "CompradorEmpresaB2B_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompradorEmpresaB2B" ADD CONSTRAINT "CompradorEmpresaB2B_tenantId_empresaId_fkey" FOREIGN KEY ("tenantId", "empresaId") REFERENCES "EmpresaB2B"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompradorEmpresaB2B" ADD CONSTRAINT "CompradorEmpresaB2B_tenantId_compradorId_fkey" FOREIGN KEY ("tenantId", "compradorId") REFERENCES "Comprador"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AutorizacaoDesejadaB2B" ADD CONSTRAINT "AutorizacaoDesejadaB2B_empresa_comprador_fkey" FOREIGN KEY ("tenantId", "empresaId", "compradorEmpresaId") REFERENCES "CompradorEmpresaB2B"("tenantId", "empresaId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutorizacaoDesejadaB2B" ADD CONSTRAINT "AutorizacaoDesejadaB2B_empresa_unidade_fkey" FOREIGN KEY ("tenantId", "empresaId", "unidadeId") REFERENCES "UnidadeEmpresaB2B"("tenantId", "empresaId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProvisionamentoCompradorB2B" ADD CONSTRAINT "ProvisionamentoCompradorB2B_tenantId_compradorEmpresaId_fkey" FOREIGN KEY ("tenantId", "compradorEmpresaId") REFERENCES "CompradorEmpresaB2B"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EscopoCompradorB2B" ADD CONSTRAINT "EscopoCompradorB2B_empresa_comprador_fkey" FOREIGN KEY ("tenantId", "empresaId", "compradorEmpresaId") REFERENCES "CompradorEmpresaB2B"("tenantId", "empresaId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EscopoCompradorB2B" ADD CONSTRAINT "EscopoCompradorB2B_empresa_unidade_fkey" FOREIGN KEY ("tenantId", "empresaId", "unidadeId") REFERENCES "UnidadeEmpresaB2B"("tenantId", "empresaId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CentroCustoB2B" ADD CONSTRAINT "CentroCustoB2B_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CentroCustoB2B" ADD CONSTRAINT "CentroCustoB2B_tenantId_empresaId_fkey" FOREIGN KEY ("tenantId", "empresaId") REFERENCES "EmpresaB2B"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompradorCentroCustoB2B" ADD CONSTRAINT "CompradorCentroCustoB2B_empresa_comprador_fkey" FOREIGN KEY ("tenantId", "empresaId", "compradorEmpresaId") REFERENCES "CompradorEmpresaB2B"("tenantId", "empresaId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompradorCentroCustoB2B" ADD CONSTRAINT "CompradorCentroCustoB2B_empresa_centro_fkey" FOREIGN KEY ("tenantId", "empresaId", "centroCustoId") REFERENCES "CentroCustoB2B"("tenantId", "empresaId", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditoriaB2B" ADD CONSTRAINT "AuditoriaB2B_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AuditoriaB2B" ADD CONSTRAINT "AuditoriaB2B_tenantId_empresaId_fkey" FOREIGN KEY ("tenantId", "empresaId") REFERENCES "EmpresaB2B"("tenantId", "id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION impedir_mutacao_auditoria_b2b() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditoriaB2B é append-only';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "AuditoriaB2B_append_only"
BEFORE UPDATE OR DELETE ON "AuditoriaB2B"
FOR EACH ROW EXECUTE FUNCTION impedir_mutacao_auditoria_b2b();
