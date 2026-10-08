-- Login do conector MCP por OAuth. Só tabelas novas: a chave `lojas_live_…`
-- (Tenant.apiKeyEnc) segue valendo para quem já conectou com ela.
CREATE TABLE "ClienteMcp" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "retornos" TEXT[],
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClienteMcp_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConexaoMcp" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "operadorId" TEXT,
    "codigoHash" TEXT,
    "codigoExpiraEm" TIMESTAMP(3),
    "codigoUsadoEm" TIMESTAMP(3),
    "desafio" TEXT,
    "retorno" TEXT,
    "acessoHash" TEXT,
    "acessoExpiraEm" TIMESTAMP(3),
    "renovacaoHash" TEXT,
    "renovacaoExpiraEm" TIMESTAMP(3),
    "ultimoUsoEm" TIMESTAMP(3),
    "revogadaEm" TIMESTAMP(3),
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConexaoMcp_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConexaoMcp_codigoHash_key" ON "ConexaoMcp"("codigoHash");
CREATE UNIQUE INDEX "ConexaoMcp_acessoHash_key" ON "ConexaoMcp"("acessoHash");
CREATE UNIQUE INDEX "ConexaoMcp_renovacaoHash_key" ON "ConexaoMcp"("renovacaoHash");
CREATE INDEX "ConexaoMcp_tenantId_idx" ON "ConexaoMcp"("tenantId");
CREATE INDEX "ConexaoMcp_clienteId_idx" ON "ConexaoMcp"("clienteId");

ALTER TABLE "ConexaoMcp" ADD CONSTRAINT "ConexaoMcp_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConexaoMcp" ADD CONSTRAINT "ConexaoMcp_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "ClienteMcp"("id") ON DELETE CASCADE ON UPDATE CASCADE;
