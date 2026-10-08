-- Webhooks para o desenvolvedor: o endereço do lojista e a fila de entregas.
-- Só tabelas novas.
CREATE TABLE "WebhookApi" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "segredoEnc" TEXT NOT NULL,
    "eventos" TEXT[],
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "falhasSeguidas" INTEGER NOT NULL DEFAULT 0,
    "desligadoEm" TIMESTAMP(3),
    "desligadoMotivo" TEXT,
    "ultimaEntregaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookApi_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EntregaWebhook" (
    "id" TEXT NOT NULL,
    "webhookId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "corpo" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "tentativas" INTEGER NOT NULL DEFAULT 0,
    "proximaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "enviandoDesde" TIMESTAMP(3),
    "ultimoStatus" INTEGER,
    "ultimoErro" TEXT,
    "criadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "entregueEm" TIMESTAMP(3),

    CONSTRAINT "EntregaWebhook_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "WebhookApi_tenantId_idx" ON "WebhookApi"("tenantId");
CREATE UNIQUE INDEX "EntregaWebhook_webhookId_eventId_key" ON "EntregaWebhook"("webhookId", "eventId");
CREATE INDEX "EntregaWebhook_status_proximaEm_idx" ON "EntregaWebhook"("status", "proximaEm");
CREATE INDEX "EntregaWebhook_tenantId_criadaEm_idx" ON "EntregaWebhook"("tenantId", "criadaEm");

ALTER TABLE "WebhookApi" ADD CONSTRAINT "WebhookApi_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntregaWebhook" ADD CONSTRAINT "EntregaWebhook_webhookId_fkey" FOREIGN KEY ("webhookId") REFERENCES "WebhookApi"("id") ON DELETE CASCADE ON UPDATE CASCADE;
