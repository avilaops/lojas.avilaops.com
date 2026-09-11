-- Outbox com corpo: reenvio, correlação e contagem de tentativas.
--
-- Sem o payload guardado, um evento FALHOU só podia ser reconstruído à mão.
-- Com ele, reenviar é reabrir a mesma linha com o mesmo corpo e um eventId
-- novo, sem inventar dado.
ALTER TABLE "AutomacaoEvento" ADD COLUMN "payload" JSONB;
ALTER TABLE "AutomacaoEvento" ADD COLUMN "correlationId" TEXT;
ALTER TABLE "AutomacaoEvento" ADD COLUMN "tentativas" INTEGER NOT NULL DEFAULT 0;
CREATE INDEX "AutomacaoEvento_correlationId_idx" ON "AutomacaoEvento"("correlationId");
