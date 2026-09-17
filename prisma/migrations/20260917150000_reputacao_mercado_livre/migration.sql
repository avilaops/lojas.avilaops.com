-- Saúde da conta da loja no Mercado Livre. Tabela nova, uma linha por loja.
CREATE TABLE "ReputacaoMercadoLivre" (
  "tenantId"      TEXT NOT NULL,
  "nivel"         TEXT,
  "selo"          TEXT,
  "transacoes"    INTEGER NOT NULL DEFAULT 0,
  "concluidas"    INTEGER NOT NULL DEFAULT 0,
  "canceladas"    INTEGER NOT NULL DEFAULT 0,
  "reclamacoes"   DOUBLE PRECISION,
  "atrasos"       DOUBLE PRECISION,
  "cancelamentos" DOUBLE PRECISION,
  "positivas"     DOUBLE PRECISION,
  "neutras"       DOUBLE PRECISION,
  "negativas"     DOUBLE PRECISION,
  "alertas"       JSONB NOT NULL DEFAULT '[]',
  "medidoEm"      TIMESTAMP(3) NOT NULL,
  "atualizadoEm"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ReputacaoMercadoLivre_pkey" PRIMARY KEY ("tenantId")
);

ALTER TABLE "ReputacaoMercadoLivre" ADD CONSTRAINT "ReputacaoMercadoLivre_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
