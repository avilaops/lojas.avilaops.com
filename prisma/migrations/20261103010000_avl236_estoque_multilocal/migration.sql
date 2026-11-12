-- AVL-236: aditivo; não reconstitui movimentações anteriores à migração.
BEGIN;

CREATE TABLE "ComandoEstoque" (
  "id" TEXT PRIMARY KEY,
  "tenantId" TEXT NOT NULL,
  "chave" TEXT NOT NULL,
  "resumoHash" TEXT NOT NULL,
  "origem" TEXT NOT NULL,
  "resultado" JSONB NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "ComandoEstoque_tenantId_chave_key" ON "ComandoEstoque"("tenantId", "chave");

CREATE TABLE "RazaoEstoque" (
  "id" TEXT PRIMARY KEY,
  "sequencia" BIGSERIAL NOT NULL UNIQUE,
  "tenantId" TEXT NOT NULL,
  "varianteId" TEXT NOT NULL,
  "local" TEXT NOT NULL,
  "tipo" TEXT NOT NULL,
  "comandoId" TEXT,
  "origem" TEXT NOT NULL,
  "motivo" TEXT NOT NULL,
  "fisicoAntes" INTEGER,
  "fisicoDepois" INTEGER,
  "reservadoAntes" INTEGER NOT NULL,
  "reservadoDepois" INTEGER NOT NULL,
  "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "RazaoEstoque_tenantId_varianteId_local_criadoEm_id_idx"
  ON "RazaoEstoque"("tenantId", "varianteId", "local", "criadoEm", "id");
CREATE INDEX "RazaoEstoque_tenantId_comandoId_idx" ON "RazaoEstoque"("tenantId", "comandoId");

-- Bloqueia escritas até a instalação do snapshot e dos triggers na mesma transação.
LOCK TABLE "SaldoEstoque" IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO "RazaoEstoque" (
  "id", "tenantId", "varianteId", "local", "tipo", "origem", "motivo",
  "fisicoAntes", "fisicoDepois", "reservadoAntes", "reservadoDepois"
)
SELECT 'avl236-abertura:' || id, "tenantId", "varianteId", "local", 'ABERTURA',
  'migracao:avl236', 'Snapshot na instalação do razão; histórico anterior não reconstituído.',
  NULL, fisico, 0, reservado FROM "SaldoEstoque";

CREATE FUNCTION avl236_razao_imutavel() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Razão e recibos de estoque são imutáveis; registre uma nova operação';
END $$ LANGUAGE plpgsql;
CREATE TRIGGER avl236_razao_imutavel BEFORE UPDATE OR DELETE OR TRUNCATE ON "RazaoEstoque"
  FOR EACH STATEMENT EXECUTE FUNCTION avl236_razao_imutavel();
CREATE TRIGGER avl236_comando_imutavel BEFORE UPDATE OR DELETE OR TRUNCATE ON "ComandoEstoque"
  FOR EACH STATEMENT EXECUTE FUNCTION avl236_razao_imutavel();

CREATE FUNCTION avl236_auditar_saldo() RETURNS trigger AS $$
DECLARE
  anterior "SaldoEstoque"%ROWTYPE;
  posterior "SaldoEstoque"%ROWTYPE;
  tipo text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW."tenantId", NEW."varianteId", NEW.local, NEW.id)
      IS DISTINCT FROM (OLD."tenantId", OLD."varianteId", OLD.local, OLD.id) THEN
      RAISE EXCEPTION 'Identidade do saldo é imutável; transfira entre locais';
    END IF;
    IF (NEW.fisico, NEW.reservado) IS NOT DISTINCT FROM (OLD.fisico, OLD.reservado) THEN
      RETURN NULL;
    END IF;
  END IF;
  IF TG_OP <> 'INSERT' THEN anterior := OLD; END IF;
  IF TG_OP <> 'DELETE' THEN posterior := NEW; END IF;
  tipo := CASE
    WHEN TG_OP = 'INSERT' THEN 'ABERTURA'
    WHEN TG_OP = 'DELETE' THEN 'REMOCAO'
    WHEN NEW.fisico IS DISTINCT FROM OLD.fisico THEN 'FISICO'
    WHEN NEW.reservado > OLD.reservado THEN 'RESERVA'
    ELSE 'LIBERACAO' END;

  INSERT INTO "RazaoEstoque" (
    "id", "tenantId", "varianteId", "local", "tipo", "comandoId", "origem", "motivo",
    "fisicoAntes", "fisicoDepois", "reservadoAntes", "reservadoDepois"
  ) VALUES (
    gen_random_uuid()::text, COALESCE(posterior."tenantId", anterior."tenantId"),
    COALESCE(posterior."varianteId", anterior."varianteId"), COALESCE(posterior.local, anterior.local),
    tipo, nullif(current_setting('lojas.estoque_comando', true), ''),
    COALESCE(nullif(current_setting('lojas.estoque_origem', true), ''), 'catalogo:legado'),
    COALESCE(nullif(current_setting('lojas.estoque_motivo', true), ''), 'Alteração de saldo pelo catálogo.'),
    anterior.fisico, posterior.fisico, COALESCE(anterior.reservado, 0), COALESCE(posterior.reservado, 0)
  );
  RETURN NULL;
END $$ LANGUAGE plpgsql;
CREATE TRIGGER avl236_auditar_saldo AFTER INSERT OR UPDATE OR DELETE ON "SaldoEstoque"
  FOR EACH ROW EXECUTE FUNCTION avl236_auditar_saldo();
CREATE TRIGGER avl236_saldo_sem_truncate BEFORE TRUNCATE ON "SaldoEstoque"
  FOR EACH STATEMENT EXECUTE FUNCTION avl236_razao_imutavel();

COMMIT;
