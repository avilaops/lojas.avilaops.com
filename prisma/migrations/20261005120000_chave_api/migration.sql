-- Chaves da API para desenvolvedores (/api/v1). Ver docs/API.md.
--
-- Guarda o sha256 da chave, não a chave. A chave antiga do MCP
-- (Tenant.apiKeyEnc) continua onde está e não é migrada: ela é cifrada e
-- carrega o slug no texto; a nova não depende do slug para ser achada.

CREATE TYPE "TipoChaveApi" AS ENUM ('SECRETA', 'PUBLICAVEL');

CREATE TABLE "ChaveApi" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "tipo" "TipoChaveApi" NOT NULL,
    "nome" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "prefixo" TEXT NOT NULL,
    "final" TEXT NOT NULL,
    "escopos" TEXT[],
    "ultimoUsoEm" TIMESTAMP(3),
    "revogadaEm" TIMESTAMP(3),
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChaveApi_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChaveApi_hash_key" ON "ChaveApi"("hash");
CREATE INDEX "ChaveApi_tenantId_idx" ON "ChaveApi"("tenantId");

ALTER TABLE "ChaveApi" ADD CONSTRAINT "ChaveApi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
