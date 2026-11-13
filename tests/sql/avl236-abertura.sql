-- Execução manual em base isolada: psql <base *_test local> -v ON_ERROR_STOP=1 -f tests/sql/avl236-abertura.sql
-- Usa schema próprio e não depende de seed ou de dados comerciais.
SELECT current_database() LIKE '%\_test' ESCAPE '\' AS base_isolada \gset
\if :base_isolada
\else
  \echo 'Este ensaio exige base com sufixo _test.'
  \quit 1
\endif

CREATE SCHEMA avl236_migracao_fixture;
SET search_path TO avl236_migracao_fixture, public;
CREATE TABLE "SaldoEstoque" (
  id text PRIMARY KEY, "tenantId" text NOT NULL, "varianteId" text NOT NULL,
  local text NOT NULL, fisico integer, reservado integer NOT NULL DEFAULT 0
);
INSERT INTO "SaldoEstoque" VALUES ('saldo-qa', 'tenant-qa', 'variante-qa', 'principal', 7, 2);
\ir ../../prisma/migrations/20261103010000_avl236_estoque_multilocal/migration.sql

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "RazaoEstoque" WHERE tipo='ABERTURA' AND "fisicoAntes" IS NULL
    AND "fisicoDepois"=7 AND "reservadoAntes"=0 AND "reservadoDepois"=2
    AND origem='migracao:avl236'
  ) OR (SELECT count(*) FROM "RazaoEstoque") <> 1 THEN
    RAISE EXCEPTION 'Snapshot de abertura diverge do saldo preexistente';
  END IF;
  UPDATE "SaldoEstoque" SET reservado=3 WHERE id='saldo-qa';
  IF NOT EXISTS (
    SELECT 1 FROM "RazaoEstoque" WHERE tipo='RESERVA'
    AND "reservadoAntes"=2 AND "reservadoDepois"=3
  ) THEN RAISE EXCEPTION 'Reserva posterior não auditada'; END IF;
  DELETE FROM "SaldoEstoque" WHERE id='saldo-qa';
  IF NOT EXISTS (
    SELECT 1 FROM "RazaoEstoque" WHERE tipo='REMOCAO'
    AND "fisicoAntes"=7 AND "fisicoDepois" IS NULL AND "reservadoAntes"=3
  ) THEN RAISE EXCEPTION 'Remoção posterior não auditada'; END IF;
END $$;

RESET search_path;
DROP SCHEMA avl236_migracao_fixture CASCADE;
\echo 'AVL-236: abertura com dados preexistentes, reserva e remoção aprovadas.'
