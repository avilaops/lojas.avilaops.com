-- Contas de comprador por loja e endereços salvos
CREATE TABLE "Comprador" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "senhaHash" TEXT NOT NULL,
  "nome" TEXT NOT NULL,
  "telefone" TEXT,
  "documento" TEXT,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "ultimoAcesso" TIMESTAMP(3),
  CONSTRAINT "Comprador_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Comprador_tenantId_email_key" ON "Comprador"("tenantId", "email");
ALTER TABLE "Comprador" ADD CONSTRAINT "Comprador_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "EnderecoComprador" (
  "id" TEXT NOT NULL,
  "compradorId" TEXT NOT NULL,
  "apelido" TEXT,
  "cep" TEXT NOT NULL,
  "logradouro" TEXT NOT NULL,
  "numero" TEXT NOT NULL,
  "complemento" TEXT,
  "bairro" TEXT NOT NULL,
  "cidade" TEXT NOT NULL,
  "uf" TEXT NOT NULL,
  "principal" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "EnderecoComprador_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "EnderecoComprador_compradorId_idx" ON "EnderecoComprador"("compradorId");
ALTER TABLE "EnderecoComprador" ADD CONSTRAINT "EnderecoComprador_compradorId_fkey" FOREIGN KEY ("compradorId") REFERENCES "Comprador"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Pedido" ADD COLUMN "compradorId" TEXT;
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_compradorId_fkey" FOREIGN KEY ("compradorId") REFERENCES "Comprador"("id") ON DELETE SET NULL ON UPDATE CASCADE;
