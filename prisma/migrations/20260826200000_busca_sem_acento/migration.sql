-- Busca sem acento. "valvula" tem que achar "Válvula": em loja brasileira,
-- quem digita no celular quase nunca acentua, e o `contains` do Prisma é só
-- case-insensitive. A coluna é mantida por gatilho para nenhum caminho de
-- escrita (painel, importação em massa, API) poder esquecer de atualizar.
ALTER TABLE "Produto" ADD COLUMN "busca" TEXT NOT NULL DEFAULT '';

CREATE OR REPLACE FUNCTION produto_texto_de_busca() RETURNS trigger AS $$
BEGIN
  NEW."busca" := translate(
    lower(concat_ws(' ', NEW."nome", NEW."marca", NEW."sku", NEW."descricaoCurta")),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER produto_busca
BEFORE INSERT OR UPDATE ON "Produto"
FOR EACH ROW EXECUTE FUNCTION produto_texto_de_busca();

-- Preenche o que já existe (o gatilho dispara no UPDATE).
UPDATE "Produto" SET "nome" = "nome";

CREATE INDEX "Produto_tenantId_busca_idx" ON "Produto"("tenantId", "busca");
