-- Impressão digital do conteúdo publicado no anúncio (título, fotos, descrição).
--
-- Nula em tudo que já existe: o primeiro ciclo depois desta migração calcula a
-- impressão e reenvia o conteúdo uma vez por anúncio, que é o comportamento
-- certo — até agora só preço e estoque subiam, e o texto do anúncio era o do
-- dia da publicação, para sempre.
ALTER TABLE "AnuncioMercadoLivre" ADD COLUMN "conteudoHash" TEXT;
