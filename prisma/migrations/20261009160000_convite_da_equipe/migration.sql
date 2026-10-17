-- O que aconteceu com o convite por e-mail de quem entra na equipe da loja
-- (ENVIADO | FALHOU | PENDENTE), o motivo e quando. So acrescenta colunas
-- nulas. O endereco de criar a senha nunca e guardado.
ALTER TABLE "OperadorLoja" ADD COLUMN IF NOT EXISTS "conviteSituacao" TEXT;
ALTER TABLE "OperadorLoja" ADD COLUMN IF NOT EXISTS "conviteDetalhe" TEXT;
ALTER TABLE "OperadorLoja" ADD COLUMN IF NOT EXISTS "conviteEm" TIMESTAMP(3);
