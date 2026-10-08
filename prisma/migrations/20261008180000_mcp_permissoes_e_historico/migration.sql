-- Conector MCP: o que cada conexão pode, e o histórico do que cada uma fez.
--
-- `escopos` nasce vazio. Em 08/10/2026 não havia conexão por login em produção
-- (a tabela tem um dia), então não há linha antiga a quem dar acesso por padrão;
-- toda conexão nova grava o que o lojista marcou na tela.
ALTER TABLE "ConexaoMcp" ADD COLUMN "escopos" TEXT[] DEFAULT ARRAY[]::TEXT[];

CREATE TABLE "ChamadaMcp" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "conexaoId" TEXT,
    "chaveId" TEXT,
    "origem" TEXT NOT NULL,
    "ferramenta" TEXT NOT NULL,
    "alterou" BOOLEAN NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "alvo" TEXT,
    "duracaoMs" INTEGER NOT NULL,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChamadaMcp_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ChamadaMcp_tenantId_criadaEm_idx" ON "ChamadaMcp"("tenantId", "criadaEm");

ALTER TABLE "ChamadaMcp" ADD CONSTRAINT "ChamadaMcp_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
