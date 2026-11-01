ALTER TABLE "SolicitacaoSobMedida"
  ADD COLUMN "fichaTecnica" JSONB,
  ADD COLUMN "fichaTecnicaVersao" INTEGER,
  ADD COLUMN "previaVersao" INTEGER;

ALTER TABLE "SolicitacaoSobMedida"
  ADD CONSTRAINT "SolicitacaoSobMedida_fichaTecnica_completa_check"
    CHECK (
      ("fichaTecnica" IS NULL AND "fichaTecnicaVersao" IS NULL AND "previaVersao" IS NULL)
      OR
      ("fichaTecnica" IS NOT NULL AND "fichaTecnicaVersao" > 0 AND "previaVersao" > 0)
    );
