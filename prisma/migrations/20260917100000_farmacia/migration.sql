-- Farmácia e drogaria: tarja, princípio ativo e responsável técnico.
--
-- A tarja é o campo que muda o que a loja pode fazer, não como ela parece:
-- medicamento sob controle especial (tarja preta e tarja vermelha com retenção)
-- não pode ser vendido pela internet (RDC 44/2009, art. 62). O padrão
-- 'nenhuma' é o correto para todo o catálogo que já existe: fralda, shampoo e
-- dermocosmético não são medicamento e não restringem nada.

ALTER TABLE "Produto" ADD COLUMN "tarja" TEXT NOT NULL DEFAULT 'nenhuma';
ALTER TABLE "Produto" ADD COLUMN "principioAtivo" TEXT;
ALTER TABLE "Produto" ADD COLUMN "apresentacao" TEXT;
ALTER TABLE "Produto" ADD COLUMN "registroAnvisa" TEXT;
ALTER TABLE "Produto" ADD COLUMN "tipoMedicamento" TEXT;

-- Responsável técnico da farmácia virtual (RDC 44/2009, art. 55): sem estes
-- dados visíveis a loja não pode se anunciar como farmácia.
ALTER TABLE "Tenant" ADD COLUMN "farmaceuticoResponsavel" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "farmaceuticoCrf" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "licencaSanitaria" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "autorizacaoAnvisa" TEXT;

-- Equivalentes por substância: a página do produto pergunta "quem mais tem
-- este princípio ativo?" a cada visita.
CREATE INDEX "Produto_tenantId_principioAtivo_idx" ON "Produto"("tenantId", "principioAtivo");

-- Busca por substância.
--
-- Quem chega à farmácia com a receita na mão digita o que o médico escreveu, e
-- isso tanto pode ser a marca ("Novalgina") quanto a molécula ("dipirona").
-- O texto de busca já é mantido por gatilho desde 20260826200000_busca_sem_acento
-- justamente para nenhum caminho de escrita poder esquecer de atualizá-lo:
-- acrescentar o princípio ativo e a apresentação ali faz a busca existente
-- passar a achar por substância sem tocar em nenhuma consulta.
CREATE OR REPLACE FUNCTION produto_texto_de_busca() RETURNS trigger AS $$
BEGIN
  NEW."busca" := translate(
    lower(concat_ws(' ', NEW."nome", NEW."marca", NEW."sku", NEW."descricaoCurta", NEW."principioAtivo", NEW."apresentacao")),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Reindexa o que já existe (o gatilho dispara no UPDATE).
UPDATE "Produto" SET "nome" = "nome";
