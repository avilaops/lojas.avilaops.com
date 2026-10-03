-- Bases que os scripts de QA exigem por nome, criadas na primeira subida do
-- container de teste. `lojas_test` já vem de POSTGRES_DB.
--
-- `scripts/conferir-migracao-catalogo.ts` cria a sua própria base
-- (`lojas_migracao_<ts>_test`) em tempo de execução; não precisa estar aqui.
CREATE DATABASE lojas_template_premium_test;
