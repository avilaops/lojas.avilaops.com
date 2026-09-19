-- O agendador da própria plataforma. Uma linha por rotina, criada na primeira
-- passada do agendador a partir de `ROTINAS` (src/lib/rotinas.ts) — não há
-- INSERT aqui de propósito: o catálogo é código, a tabela é estado.
--
-- A linha é a trava distribuída: dois containers rodando o mesmo deploy
-- tentam o mesmo UPDATE condicional e só um leva a rotina.
CREATE TABLE "Rotina" (
  "nome"            TEXT NOT NULL,
  "proximaEm"       TIMESTAMP(3) NOT NULL,
  "executandoDesde" TIMESTAMP(3),
  "ultimaEm"        TIMESTAMP(3),
  "ultimaDuracaoMs" INTEGER,
  "ultimoResumo"    JSONB,
  "ultimoErro"      TEXT,
  "falhasSeguidas"  INTEGER NOT NULL DEFAULT 0,
  "execucoes"       INTEGER NOT NULL DEFAULT 0,
  "criadaEm"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Rotina_pkey" PRIMARY KEY ("nome")
);

CREATE INDEX "Rotina_proximaEm_idx" ON "Rotina"("proximaEm");
