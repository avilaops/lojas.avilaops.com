-- Mercado Livre: credencial por loja e espelho de anuncio.
--
-- A conta e a mesma do Mercado Pago (provado em 02/09/2026: o token do MP
-- responde em api.mercadolibre.com/users/me com id, nickname e site_id), mas o
-- token de pagamento nao carrega escopo de venda. Por isso credencial propria,
-- guardada cifrada como a do MP.

ALTER TABLE "Tenant"
  ADD COLUMN "mlUserId"          TEXT,
  ADD COLUMN "mlNickname"        TEXT,
  ADD COLUMN "mlAccessTokenEnc"  TEXT,
  ADD COLUMN "mlRefreshTokenEnc" TEXT,
  ADD COLUMN "mlExpiraEm"        TIMESTAMP(3),
  ADD COLUMN "mlConectadoEm"     TIMESTAMP(3);

CREATE TABLE "AnuncioMercadoLivre" (
  "id"                     TEXT NOT NULL,
  "tenantId"               TEXT NOT NULL,
  "produtoId"              TEXT NOT NULL,
  "mlbId"                  TEXT,
  "categoriaMl"            TEXT,
  "statusMl"               TEXT,
  "permalink"              TEXT,
  "estado"                 TEXT NOT NULL DEFAULT 'rascunho',
  "motivoErro"             TEXT,
  "precoCentavosPublicado" INTEGER,
  "estoquePublicado"       INTEGER,
  "sincronizadoEm"         TIMESTAMP(3),
  "criadoEm"               TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm"           TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AnuncioMercadoLivre_pkey" PRIMARY KEY ("id")
);

-- Um anuncio por produto por loja: e isto que impede a sincronizacao de criar
-- anuncio duplicado a cada rodada, que e o erro que mais irrita comprador.
CREATE UNIQUE INDEX "AnuncioMercadoLivre_tenantId_produtoId_key"
  ON "AnuncioMercadoLivre"("tenantId", "produtoId");
CREATE UNIQUE INDEX "AnuncioMercadoLivre_mlbId_key"
  ON "AnuncioMercadoLivre"("mlbId");
CREATE INDEX "AnuncioMercadoLivre_tenantId_estado_idx"
  ON "AnuncioMercadoLivre"("tenantId", "estado");

ALTER TABLE "AnuncioMercadoLivre"
  ADD CONSTRAINT "AnuncioMercadoLivre_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "AnuncioMercadoLivre_produtoId_fkey"
  FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE CASCADE ON UPDATE CASCADE;
