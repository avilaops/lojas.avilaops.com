-- Idempotência dos eventos plataforma → n8n. O webhook é at-least-once: o n8n
-- reivindica o eventId antes de mandar WhatsApp/e-mail, e a segunda entrega
-- do mesmo evento para aqui.
CREATE TYPE "AutomacaoEventoStatus" AS ENUM ('EMITIDO', 'PROCESSANDO', 'PROCESSADO', 'FALHOU', 'IGNORADO');

CREATE TABLE IF NOT EXISTS "AutomacaoEvento" (
  "eventId"        TEXT NOT NULL,
  "tipo"           TEXT NOT NULL,
  "slug"           TEXT NOT NULL,
  "versao"         INTEGER NOT NULL DEFAULT 1,
  "status"         "AutomacaoEventoStatus" NOT NULL DEFAULT 'EMITIDO',
  "detalhe"        TEXT,
  "emitidoEm"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reivindicadoEm" TIMESTAMP(3),
  "concluidoEm"    TIMESTAMP(3),
  CONSTRAINT "AutomacaoEvento_pkey" PRIMARY KEY ("eventId")
);

CREATE INDEX IF NOT EXISTS "AutomacaoEvento_slug_tipo_idx" ON "AutomacaoEvento"("slug", "tipo");
CREATE INDEX IF NOT EXISTS "AutomacaoEvento_status_emitidoEm_idx" ON "AutomacaoEvento"("status", "emitidoEm");
