CREATE TYPE "SituacaoContratoComercial" AS ENUM ('ATIVO', 'ENCERRADO');

CREATE TABLE "ContratoComercial" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "versao" INTEGER NOT NULL,
    "plano" "Plano" NOT NULL,
    "mensalidadeCentavos" INTEGER NOT NULL,
    "comissaoPontosBase" INTEGER NOT NULL,
    "vigenteDesde" TIMESTAMP(3) NOT NULL,
    "vigenteAte" TIMESTAMP(3),
    "situacao" "SituacaoContratoComercial" NOT NULL DEFAULT 'ATIVO',
    "aceiteEm" TIMESTAMP(3),
    "aceiteReferencia" TEXT,
    "origem" TEXT NOT NULL,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContratoComercial_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ContratoComercial_valores_check" CHECK (
      "mensalidadeCentavos" >= 0 AND
      "comissaoPontosBase" >= 0 AND
      "comissaoPontosBase" <= 10000 AND
      ("vigenteAte" IS NULL OR "vigenteAte" > "vigenteDesde")
    )
);

ALTER TABLE "Pedido" ADD COLUMN "contratoComercialId" TEXT;

CREATE UNIQUE INDEX "ContratoComercial_tenantId_versao_key" ON "ContratoComercial"("tenantId", "versao");
CREATE UNIQUE INDEX "ContratoComercial_um_ativo_por_tenant_key" ON "ContratoComercial"("tenantId") WHERE "situacao" = 'ATIVO';
CREATE INDEX "ContratoComercial_tenantId_vigenteDesde_vigenteAte_idx" ON "ContratoComercial"("tenantId", "vigenteDesde", "vigenteAte");
CREATE INDEX "Pedido_contratoComercialId_idx" ON "Pedido"("contratoComercialId");

ALTER TABLE "ContratoComercial" ADD CONSTRAINT "ContratoComercial_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_contratoComercialId_fkey"
  FOREIGN KEY ("contratoComercialId") REFERENCES "ContratoComercial"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Todos os clientes atuais preservam a mensalidade e começam sem comissão.
-- As duas exceções abaixo são decisões comerciais expressas, identificadas
-- pelo slug estável da plataforma, nunca pelo nome exibido.
INSERT INTO "ContratoComercial" (
  "id", "tenantId", "versao", "plano", "mensalidadeCentavos",
  "comissaoPontosBase", "vigenteDesde", "situacao",
  "aceiteEm", "aceiteReferencia", "origem"
)
SELECT
  'cc_' || md5(t.id), t.id, 1, t.plano,
  CASE
    WHEN t.slug = 'vedashow' THEN 35000
    WHEN t."faixaPreco" = 'loja-pro-350' AND t.plano = 'LOJA_PRO' THEN 35000
    WHEN t.plano = 'SITE' THEN 11000
    WHEN t.plano = 'LOJA' THEN 26900
    ELSE 49700
  END,
  CASE WHEN t.slug = 'vedashow' THEN 500 WHEN t.slug = 'bereta-rodas' THEN 300 ELSE 0 END,
  t."criadoEm", 'ATIVO', t."criadoEm", 'contrato-legado-2026-10-18', 'MIGRACAO'
FROM "Tenant" t;
