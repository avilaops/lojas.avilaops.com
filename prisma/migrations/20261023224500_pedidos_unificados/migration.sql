ALTER TYPE "PedidoStatus" ADD VALUE IF NOT EXISTS 'COTADO' BEFORE 'AGUARDANDO_PAGAMENTO';
ALTER TYPE "PedidoStatus" ADD VALUE IF NOT EXISTS 'APROVADO' BEFORE 'AGUARDANDO_PAGAMENTO';

ALTER TABLE "Pedido"
  ADD COLUMN "vendedorEmail" TEXT,
  ADD COLUMN "unidadeB2BId" TEXT;

ALTER TABLE "PedidoItem"
  ADD COLUMN "quantidadePaga" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "quantidadeExpedida" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "quantidadeCancelada" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "quantidadeDevolvida" INTEGER NOT NULL DEFAULT 0;

UPDATE "PedidoItem" AS item
SET "quantidadePaga" = item."quantidade"
FROM "Pedido" AS pedido
WHERE pedido.id = item."pedidoId"
  AND pedido.status IN ('PAGO', 'EM_SEPARACAO', 'ENVIADO', 'ENTREGUE', 'ESTORNADO');

UPDATE "PedidoItem" AS item
SET "quantidadeExpedida" = item."quantidade"
FROM "Pedido" AS pedido
WHERE pedido.id = item."pedidoId"
  AND pedido.status IN ('ENVIADO', 'ENTREGUE');

UPDATE "PedidoItem" AS item
SET "quantidadeCancelada" = item."quantidade"
FROM "Pedido" AS pedido
WHERE pedido.id = item."pedidoId" AND pedido.status = 'CANCELADO';

CREATE TABLE "EventoPedido" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "pedidoId" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "deStatus" "PedidoStatus",
  "paraStatus" "PedidoStatus",
  "atorTipo" TEXT NOT NULL,
  "atorId" TEXT,
  "atorEmail" TEXT,
  "origem" TEXT NOT NULL,
  "idempotencia" TEXT NOT NULL,
  "dados" JSONB NOT NULL DEFAULT '{}',
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventoPedido_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventoPedido_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "EventoPedido_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EventoPedido_tenantId_idempotencia_key" ON "EventoPedido"("tenantId", "idempotencia");
CREATE INDEX "EventoPedido_tenantId_pedidoId_criadoEm_idx" ON "EventoPedido"("tenantId", "pedidoId", "criadoEm");

ALTER TABLE "Pedido"
  ADD CONSTRAINT "Pedido_tenantId_empresaB2BId_unidadeB2BId_fkey"
  FOREIGN KEY ("tenantId", "empresaB2BId", "unidadeB2BId")
  REFERENCES "UnidadeEmpresaB2B"("tenantId", "empresaId", "id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
