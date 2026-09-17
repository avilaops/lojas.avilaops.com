-- Perguntas de comprador no Mercado Livre.
--
-- Tabela nova, sem efeito em nada que já existe. `mlId` é único porque o aviso
-- do ML chega repetido; é ele que impede a mesma pergunta de entrar duas vezes.
CREATE TABLE "PerguntaMercadoLivre" (
  "id"            TEXT NOT NULL,
  "tenantId"      TEXT NOT NULL,
  "mlId"          TEXT NOT NULL,
  "mlbId"         TEXT NOT NULL,
  "anuncioId"     TEXT,
  "produtoId"     TEXT,
  "texto"         TEXT NOT NULL,
  "autor"         TEXT,
  "statusMl"      TEXT NOT NULL DEFAULT 'UNANSWERED',
  "resposta"      TEXT,
  "respondidaPor" TEXT,
  "respondidaEm"  TIMESTAMP(3),
  "motivoErro"    TEXT,
  "perguntadaEm"  TIMESTAMP(3) NOT NULL,
  "criadoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PerguntaMercadoLivre_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PerguntaMercadoLivre_mlId_key" ON "PerguntaMercadoLivre"("mlId");
CREATE INDEX "PerguntaMercadoLivre_tenantId_statusMl_perguntadaEm_idx" ON "PerguntaMercadoLivre"("tenantId", "statusMl", "perguntadaEm");
CREATE INDEX "PerguntaMercadoLivre_tenantId_mlbId_idx" ON "PerguntaMercadoLivre"("tenantId", "mlbId");

ALTER TABLE "PerguntaMercadoLivre" ADD CONSTRAINT "PerguntaMercadoLivre_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerguntaMercadoLivre" ADD CONSTRAINT "PerguntaMercadoLivre_anuncioId_fkey"
  FOREIGN KEY ("anuncioId") REFERENCES "AnuncioMercadoLivre"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PerguntaMercadoLivre" ADD CONSTRAINT "PerguntaMercadoLivre_produtoId_fkey"
  FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
