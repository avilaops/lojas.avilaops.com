-- O configurador é opt-in: publicar o código não pode abrir a rota em todas as
-- lojas. A MRG é o tenant contratante deste recurso; a condição torna a
-- migração segura em bancos de teste e idempotente em restaurações.
UPDATE "Tenant"
SET "recursos" = array_append("recursos", 'configurador_sob_medida'),
    "atualizadoEm" = CURRENT_TIMESTAMP
WHERE "slug" = 'mrg-caixas-termicas'
  AND NOT ('configurador_sob_medida' = ANY("recursos"));
