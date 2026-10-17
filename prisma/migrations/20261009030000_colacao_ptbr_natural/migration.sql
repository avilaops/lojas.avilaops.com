-- Colação para ordenar nome de produto, marca e categoria em português do
-- Brasil com número contando como número ("Item 2" antes de "Item 10").
--
-- Usada pela consulta de administração do catálogo
-- (src/lib/catalogo-admin-consulta.ts), que ordena no banco em vez de mandar o
-- catálogo inteiro para quem perguntou. Só cria o objeto: não altera tabela,
-- coluna nem índice, e nenhuma linha é lida ou gravada.
CREATE COLLATION IF NOT EXISTS "ptbr_natural" (provider = icu, locale = 'pt-BR-u-kn-true');
