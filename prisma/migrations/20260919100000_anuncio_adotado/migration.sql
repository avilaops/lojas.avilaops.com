-- De quem é o texto do anúncio. "propria" descreve tudo o que existe até aqui:
-- até esta migração, o único jeito de um anúncio ganhar mlbId era a plataforma
-- publicá-lo. Nenhuma linha é reclassificada.
ALTER TABLE "AnuncioMercadoLivre" ADD COLUMN "origem" TEXT NOT NULL DEFAULT 'propria';
