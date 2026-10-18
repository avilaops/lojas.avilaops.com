CREATE TABLE "EventoSaudeCanal" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "canal" VARCHAR(40) NOT NULL,
  "tipo" VARCHAR(40) NOT NULL,
  "resultado" VARCHAR(24) NOT NULL,
  "codigo" VARCHAR(64) NOT NULL,
  "mensagem" VARCHAR(240) NOT NULL,
  "ator" VARCHAR(160) NOT NULL,
  "dedupeKey" VARCHAR(160),
  "ocorridoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EventoSaudeCanal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EventoSaudeCanal_campos_check" CHECK (
    length("canal") BETWEEN 1 AND 40 AND
    length("tipo") BETWEEN 1 AND 40 AND
    "resultado" IN ('iniciado', 'sucesso', 'erro', 'informativo') AND
    length("codigo") BETWEEN 1 AND 64 AND
    length("mensagem") BETWEEN 1 AND 240 AND
    length("ator") BETWEEN 1 AND 160
  )
);

CREATE UNIQUE INDEX "EventoSaudeCanal_dedupeKey_key" ON "EventoSaudeCanal"("dedupeKey");
CREATE INDEX "EventoSaudeCanal_tenantId_canal_ocorridoEm_idx" ON "EventoSaudeCanal"("tenantId", "canal", "ocorridoEm" DESC);
CREATE INDEX "EventoSaudeCanal_tenantId_ocorridoEm_idx" ON "EventoSaudeCanal"("tenantId", "ocorridoEm" DESC);

ALTER TABLE "EventoSaudeCanal"
  ADD CONSTRAINT "EventoSaudeCanal_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION bloquear_mutacao_evento_saude_canal()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM "Tenant" WHERE "id" = OLD."tenantId") THEN
    RETURN OLD;
  END IF;
  RAISE EXCEPTION 'EventoSaudeCanal e append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "EventoSaudeCanal_append_only"
BEFORE UPDATE OR DELETE ON "EventoSaudeCanal"
FOR EACH ROW EXECUTE FUNCTION bloquear_mutacao_evento_saude_canal();
