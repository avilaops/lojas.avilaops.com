BEGIN;

CREATE TABLE "PesquisaCatalogoExecucao" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "escopo" TEXT NOT NULL,
  "estado" TEXT NOT NULL DEFAULT 'EM_ANDAMENTO',
  "iniciadoPor" TEXT NOT NULL,
  "parametros" JSONB NOT NULL DEFAULT '{}',
  "iniciadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "concluidoEm" TIMESTAMP(3),
  CONSTRAINT "PesquisaCatalogoExecucao_estado_ck" CHECK ("estado" IN ('EM_ANDAMENTO','CONCLUIDA','FALHOU','CANCELADA'))
);

CREATE TABLE "FontePesquisaCatalogo" (
  "id" TEXT PRIMARY KEY,
  "execucaoId" TEXT NOT NULL REFERENCES "PesquisaCatalogoExecucao"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "url" TEXT NOT NULL,
  "titulo" TEXT,
  "dominio" TEXT NOT NULL,
  "tipo" TEXT NOT NULL DEFAULT 'pagina_produto',
  "coletadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "conteudoHash" TEXT,
  CONSTRAINT "FontePesquisaCatalogo_url_ck" CHECK ("url" ~ '^https?://'),
  CONSTRAINT "FontePesquisaCatalogo_execucaoId_url_key" UNIQUE ("execucaoId", "url")
);

CREATE TABLE "CorrespondenciaPesquisaProduto" (
  "id" TEXT PRIMARY KEY,
  "execucaoId" TEXT NOT NULL REFERENCES "PesquisaCatalogoExecucao"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "tenantId" TEXT NOT NULL,
  "produtoId" TEXT NOT NULL,
  "regra" TEXT NOT NULL,
  "confianca" TEXT NOT NULL,
  "confirmada" BOOLEAN,
  "revisadoPor" TEXT,
  "revisadoEm" TIMESTAMP(3),
  "observacao" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CorrespondenciaPesquisaProduto_produto_fk" FOREIGN KEY ("tenantId", "produtoId") REFERENCES "Produto"("tenantId", "id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CorrespondenciaPesquisaProduto_confianca_ck" CHECK ("confianca" IN ('alta','media','baixa')),
  CONSTRAINT "CorrespondenciaPesquisaProduto_revisao_ck" CHECK ("confirmada" IS NULL OR ("revisadoPor" IS NOT NULL AND "revisadoEm" IS NOT NULL)),
  CONSTRAINT "CorrespondenciaPesquisaProduto_execucaoId_produtoId_key" UNIQUE ("execucaoId", "produtoId")
);

CREATE TABLE "ReferenciaPesquisaProduto" (
  "id" TEXT PRIMARY KEY,
  "correspondenciaId" TEXT NOT NULL REFERENCES "CorrespondenciaPesquisaProduto"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "fonteId" TEXT NOT NULL REFERENCES "FontePesquisaCatalogo"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "tipo" TEXT NOT NULL,
  "valor" TEXT NOT NULL,
  "marca" TEXT,
  "evidencia" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferenciaPesquisaProduto_correspondenciaId_fonteId_tipo_valor_key" UNIQUE ("correspondenciaId", "fonteId", "tipo", "valor")
);

CREATE TABLE "FatoPesquisaProduto" (
  "id" TEXT PRIMARY KEY,
  "correspondenciaId" TEXT NOT NULL REFERENCES "CorrespondenciaPesquisaProduto"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "fonteId" TEXT NOT NULL REFERENCES "FontePesquisaCatalogo"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "campo" TEXT NOT NULL,
  "valor" JSONB NOT NULL,
  "confianca" TEXT NOT NULL,
  "evidencia" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FatoPesquisaProduto_confianca_ck" CHECK ("confianca" IN ('alta','media','baixa')),
  CONSTRAINT "FatoPesquisaProduto_correspondenciaId_fonteId_campo_key" UNIQUE ("correspondenciaId", "fonteId", "campo")
);

CREATE TABLE "ImagemCandidataProduto" (
  "id" TEXT PRIMARY KEY,
  "correspondenciaId" TEXT NOT NULL REFERENCES "CorrespondenciaPesquisaProduto"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "fonteId" TEXT NOT NULL REFERENCES "FontePesquisaCatalogo"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "urlOriginal" TEXT NOT NULL,
  "urlArmazenada" TEXT,
  "sha256" TEXT,
  "mime" TEXT,
  "larguraPx" INTEGER,
  "alturaPx" INTEGER,
  "direitoUso" TEXT NOT NULL DEFAULT 'DESCONHECIDO',
  "correspondenciaExata" BOOLEAN NOT NULL DEFAULT false,
  "estado" TEXT NOT NULL DEFAULT 'PENDENTE',
  "promovidaUrl" TEXT,
  "promovidaEm" TIMESTAMP(3),
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ImagemCandidataProduto_url_ck" CHECK ("urlOriginal" ~ '^https?://' AND ("urlArmazenada" IS NULL OR "urlArmazenada" ~ '^https?://')),
  CONSTRAINT "ImagemCandidataProduto_direito_ck" CHECK ("direitoUso" IN ('DESCONHECIDO','PERMITIDO','NEGADO')),
  CONSTRAINT "ImagemCandidataProduto_estado_ck" CHECK ("estado" IN ('PENDENTE','APROVADA','REJEITADA','PROMOVIDA')),
  CONSTRAINT "ImagemCandidataProduto_correspondenciaId_urlOriginal_key" UNIQUE ("correspondenciaId", "urlOriginal")
);

CREATE INDEX "PesquisaCatalogoExecucao_tenantId_estado_iniciadoEm_idx" ON "PesquisaCatalogoExecucao"("tenantId", "estado", "iniciadoEm");
CREATE INDEX "CorrespondenciaPesquisaProduto_tenantId_produtoId_confirmada_idx" ON "CorrespondenciaPesquisaProduto"("tenantId", "produtoId", "confirmada");
CREATE INDEX "ReferenciaPesquisaProduto_tipo_valor_idx" ON "ReferenciaPesquisaProduto"("tipo", "valor");
CREATE INDEX "ImagemCandidataProduto_estado_criadoEm_idx" ON "ImagemCandidataProduto"("estado", "criadoEm");

COMMIT;
