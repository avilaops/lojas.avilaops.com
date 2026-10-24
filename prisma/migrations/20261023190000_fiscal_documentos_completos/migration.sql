-- Projeções fiscais são aditivas. O XML original de DocumentoFiscalLoja permanece imutável.
ALTER TABLE "DocumentoFiscalLoja"
  ADD COLUMN "tipoDocumento" TEXT,
  ADD COLUMN "modelo" TEXT,
  ADD COLUMN "versaoSchema" TEXT,
  ADD COLUMN "origem" TEXT NOT NULL DEFAULT 'SEFAZ_DISTRIBUICAO',
  ADD COLUMN "identificadorExterno" TEXT,
  ADD COLUMN "hashXml" TEXT,
  ADD COLUMN "estadoConteudo" TEXT NOT NULL DEFAULT 'DESCONHECIDO',
  ADD COLUMN "validacao" TEXT NOT NULL DEFAULT 'NAO_VALIDADO',
  ADD COLUMN "errosInterpretacao" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "parserVersao" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "dadosIncompletos" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "papelEmpresa" TEXT,
  ADD COLUMN "categoria" TEXT,
  ADD COLUMN "numero" TEXT,
  ADD COLUMN "serie" TEXT,
  ADD COLUMN "emitidaEm" TIMESTAMP(3),
  ADD COLUMN "autorizadaEm" TIMESTAMP(3),
  ADD COLUMN "statusFiscal" TEXT,
  ADD COLUMN "protocolo" TEXT,
  ADD COLUMN "cancelada" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "emitenteDocumento" TEXT,
  ADD COLUMN "emitenteNome" TEXT,
  ADD COLUMN "destinatarioDocumento" TEXT,
  ADD COLUMN "destinatarioNome" TEXT;

CREATE TABLE "EventoFiscalLoja" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "documentoId" TEXT NOT NULL,
  "documentoPrincipalId" TEXT,
  "codigo" TEXT NOT NULL,
  "descricao" TEXT,
  "sequencia" INTEGER NOT NULL,
  "autorDocumento" TEXT,
  "ocorridoEm" TIMESTAMP(3),
  "registradoEm" TIMESTAMP(3),
  "protocolo" TEXT,
  "status" TEXT,
  "motivo" TEXT,
  "xmlOriginal" TEXT NOT NULL,
  "hashXml" TEXT NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventoFiscalLoja_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ManifestacaoFiscalLoja" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "documentoId" TEXT NOT NULL,
  "idempotencia" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "justificativa" TEXT,
  "autor" TEXT NOT NULL,
  "ambiente" TEXT NOT NULL,
  "lote" TEXT,
  "sequencia" INTEGER NOT NULL,
  "intencaoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "enviadoEm" TIMESTAMP(3),
  "concluidoEm" TIMESTAMP(3),
  "protocolo" TEXT,
  "status" TEXT NOT NULL DEFAULT 'INTENCAO_REGISTRADA',
  "codigoRetorno" TEXT,
  "motivoRetorno" TEXT,
  "xmlEnviado" TEXT,
  "xmlResposta" TEXT,
  "tentativas" INTEGER NOT NULL DEFAULT 0,
  "proximaTentativaEm" TIMESTAMP(3),
  "resultadoFinal" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "ManifestacaoFiscalLoja_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ParticipanteFiscalLoja" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "documentoId" TEXT NOT NULL,
  "papel" TEXT NOT NULL, "documento" TEXT, "inscricaoEstadual" TEXT,
  "razaoSocial" TEXT, "nomeFantasia" TEXT, "endereco" JSONB, "contatos" JSONB,
  CONSTRAINT "ParticipanteFiscalLoja_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ItemFiscalLoja" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "documentoId" TEXT NOT NULL,
  "numero" INTEGER NOT NULL, "codigo" TEXT, "gtin" TEXT, "descricao" TEXT NOT NULL,
  "ncm" TEXT, "cest" TEXT, "cfop" TEXT, "unidade" TEXT,
  "quantidade" DECIMAL(24,8), "valorUnitario" DECIMAL(24,10), "valorTotal" DECIMAL(24,2),
  "desconto" DECIMAL(24,2), "frete" DECIMAL(24,2), "seguro" DECIMAL(24,2),
  "outrasDespesas" DECIMAL(24,2), "pedido" TEXT, "itemPedido" TEXT, "detalhes" JSONB,
  CONSTRAINT "ItemFiscalLoja_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TributoFiscalLoja" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "itemId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL, "origem" TEXT, "codigo" TEXT,
  "baseCalculo" DECIMAL(24,2), "aliquota" DECIMAL(12,8), "valor" DECIMAL(24,2), "detalhes" JSONB,
  CONSTRAINT "TributoFiscalLoja_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PagamentoFiscalLoja" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "documentoId" TEXT NOT NULL,
  "meio" TEXT, "valor" DECIMAL(24,2), "troco" DECIMAL(24,2), "detalhes" JSONB,
  CONSTRAINT "PagamentoFiscalLoja_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ParcelaFiscalLoja" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "pagamentoId" TEXT NOT NULL,
  "numero" TEXT, "vencimento" TIMESTAMP(3), "valor" DECIMAL(24,2),
  CONSTRAINT "ParcelaFiscalLoja_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TransporteFiscalLoja" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "documentoId" TEXT NOT NULL,
  "modalidade" TEXT, "transportadorDocumento" TEXT, "transportadorNome" TEXT,
  "veiculo" JSONB, "volumes" JSONB, "pesoLiquido" DECIMAL(24,8), "pesoBruto" DECIMAL(24,8), "detalhes" JSONB,
  CONSTRAINT "TransporteFiscalLoja_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AnexoFiscalLoja" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "documentoId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL, "nome" TEXT NOT NULL, "mime" TEXT NOT NULL, "origem" TEXT NOT NULL,
  "armazenamento" TEXT, "hash" TEXT, "erro" TEXT, "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AnexoFiscalLoja_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditoriaFiscalLoja" (
  "id" TEXT NOT NULL, "tenantId" TEXT NOT NULL, "documentoId" TEXT, "manifestacaoId" TEXT,
  "acao" TEXT NOT NULL, "ator" TEXT NOT NULL, "dados" JSONB NOT NULL,
  "ocorridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditoriaFiscalLoja_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventoFiscalLoja_tenantId_hashXml_key" ON "EventoFiscalLoja"("tenantId", "hashXml");
CREATE UNIQUE INDEX "EventoFiscalLoja_tenantId_documentoPrincipalId_codigo_sequencia_key" ON "EventoFiscalLoja"("tenantId", "documentoPrincipalId", "codigo", "sequencia");
CREATE UNIQUE INDEX "ManifestacaoFiscalLoja_tenantId_idempotencia_key" ON "ManifestacaoFiscalLoja"("tenantId", "idempotencia");
CREATE UNIQUE INDEX "ItemFiscalLoja_documentoId_numero_key" ON "ItemFiscalLoja"("documentoId", "numero");
CREATE UNIQUE INDEX "AnexoFiscalLoja_tenantId_documentoId_tipo_hash_key" ON "AnexoFiscalLoja"("tenantId", "documentoId", "tipo", "hash");

CREATE INDEX "DocumentoFiscalLoja_tenantId_tipoDocumento_papelEmpresa_emitidaEm_idx" ON "DocumentoFiscalLoja"("tenantId", "tipoDocumento", "papelEmpresa", "emitidaEm");
CREATE INDEX "DocumentoFiscalLoja_tenantId_emitenteDocumento_recebidoEm_idx" ON "DocumentoFiscalLoja"("tenantId", "emitenteDocumento", "recebidoEm");
CREATE INDEX "DocumentoFiscalLoja_tenantId_destinatarioDocumento_recebidoEm_idx" ON "DocumentoFiscalLoja"("tenantId", "destinatarioDocumento", "recebidoEm");
CREATE INDEX "DocumentoFiscalLoja_tenantId_numero_serie_idx" ON "DocumentoFiscalLoja"("tenantId", "numero", "serie");
CREATE INDEX "DocumentoFiscalLoja_tenantId_statusFiscal_categoria_idx" ON "DocumentoFiscalLoja"("tenantId", "statusFiscal", "categoria");
CREATE INDEX "DocumentoFiscalLoja_tenantId_protocolo_idx" ON "DocumentoFiscalLoja"("tenantId", "protocolo");
CREATE INDEX "DocumentoFiscalLoja_tenantId_hashXml_idx" ON "DocumentoFiscalLoja"("tenantId", "hashXml");
CREATE INDEX "EventoFiscalLoja_tenantId_codigo_registradoEm_idx" ON "EventoFiscalLoja"("tenantId", "codigo", "registradoEm");
CREATE INDEX "EventoFiscalLoja_documentoPrincipalId_ocorridoEm_idx" ON "EventoFiscalLoja"("documentoPrincipalId", "ocorridoEm");
CREATE INDEX "ManifestacaoFiscalLoja_tenantId_status_proximaTentativaEm_idx" ON "ManifestacaoFiscalLoja"("tenantId", "status", "proximaTentativaEm");
CREATE INDEX "ManifestacaoFiscalLoja_documentoId_intencaoEm_idx" ON "ManifestacaoFiscalLoja"("documentoId", "intencaoEm");
CREATE INDEX "ParticipanteFiscalLoja_tenantId_papel_documento_idx" ON "ParticipanteFiscalLoja"("tenantId", "papel", "documento");
CREATE INDEX "ParticipanteFiscalLoja_documentoId_papel_idx" ON "ParticipanteFiscalLoja"("documentoId", "papel");
CREATE INDEX "ItemFiscalLoja_tenantId_codigo_idx" ON "ItemFiscalLoja"("tenantId", "codigo");
CREATE INDEX "ItemFiscalLoja_tenantId_descricao_idx" ON "ItemFiscalLoja"("tenantId", "descricao");
CREATE INDEX "ItemFiscalLoja_tenantId_ncm_cfop_idx" ON "ItemFiscalLoja"("tenantId", "ncm", "cfop");
CREATE INDEX "TributoFiscalLoja_tenantId_tipo_codigo_idx" ON "TributoFiscalLoja"("tenantId", "tipo", "codigo");
CREATE INDEX "TributoFiscalLoja_itemId_tipo_idx" ON "TributoFiscalLoja"("itemId", "tipo");
CREATE INDEX "PagamentoFiscalLoja_tenantId_meio_idx" ON "PagamentoFiscalLoja"("tenantId", "meio");
CREATE INDEX "PagamentoFiscalLoja_documentoId_idx" ON "PagamentoFiscalLoja"("documentoId");
CREATE INDEX "ParcelaFiscalLoja_tenantId_vencimento_idx" ON "ParcelaFiscalLoja"("tenantId", "vencimento");
CREATE INDEX "ParcelaFiscalLoja_pagamentoId_idx" ON "ParcelaFiscalLoja"("pagamentoId");
CREATE INDEX "TransporteFiscalLoja_tenantId_transportadorDocumento_idx" ON "TransporteFiscalLoja"("tenantId", "transportadorDocumento");
CREATE INDEX "TransporteFiscalLoja_documentoId_idx" ON "TransporteFiscalLoja"("documentoId");
CREATE INDEX "AnexoFiscalLoja_documentoId_tipo_idx" ON "AnexoFiscalLoja"("documentoId", "tipo");
CREATE INDEX "AuditoriaFiscalLoja_tenantId_ocorridoEm_idx" ON "AuditoriaFiscalLoja"("tenantId", "ocorridoEm");
CREATE INDEX "AuditoriaFiscalLoja_documentoId_ocorridoEm_idx" ON "AuditoriaFiscalLoja"("documentoId", "ocorridoEm");
CREATE INDEX "AuditoriaFiscalLoja_manifestacaoId_ocorridoEm_idx" ON "AuditoriaFiscalLoja"("manifestacaoId", "ocorridoEm");

ALTER TABLE "EventoFiscalLoja" ADD CONSTRAINT "EventoFiscalLoja_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventoFiscalLoja" ADD CONSTRAINT "EventoFiscalLoja_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoFiscalLoja"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EventoFiscalLoja" ADD CONSTRAINT "EventoFiscalLoja_documentoPrincipalId_fkey" FOREIGN KEY ("documentoPrincipalId") REFERENCES "DocumentoFiscalLoja"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ManifestacaoFiscalLoja" ADD CONSTRAINT "ManifestacaoFiscalLoja_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManifestacaoFiscalLoja" ADD CONSTRAINT "ManifestacaoFiscalLoja_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoFiscalLoja"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ParticipanteFiscalLoja" ADD CONSTRAINT "ParticipanteFiscalLoja_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParticipanteFiscalLoja" ADD CONSTRAINT "ParticipanteFiscalLoja_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoFiscalLoja"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemFiscalLoja" ADD CONSTRAINT "ItemFiscalLoja_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ItemFiscalLoja" ADD CONSTRAINT "ItemFiscalLoja_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoFiscalLoja"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TributoFiscalLoja" ADD CONSTRAINT "TributoFiscalLoja_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TributoFiscalLoja" ADD CONSTRAINT "TributoFiscalLoja_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "ItemFiscalLoja"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PagamentoFiscalLoja" ADD CONSTRAINT "PagamentoFiscalLoja_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PagamentoFiscalLoja" ADD CONSTRAINT "PagamentoFiscalLoja_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoFiscalLoja"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParcelaFiscalLoja" ADD CONSTRAINT "ParcelaFiscalLoja_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParcelaFiscalLoja" ADD CONSTRAINT "ParcelaFiscalLoja_pagamentoId_fkey" FOREIGN KEY ("pagamentoId") REFERENCES "PagamentoFiscalLoja"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransporteFiscalLoja" ADD CONSTRAINT "TransporteFiscalLoja_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TransporteFiscalLoja" ADD CONSTRAINT "TransporteFiscalLoja_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoFiscalLoja"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnexoFiscalLoja" ADD CONSTRAINT "AnexoFiscalLoja_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AnexoFiscalLoja" ADD CONSTRAINT "AnexoFiscalLoja_documentoId_fkey" FOREIGN KEY ("documentoId") REFERENCES "DocumentoFiscalLoja"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AuditoriaFiscalLoja" ADD CONSTRAINT "AuditoriaFiscalLoja_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
