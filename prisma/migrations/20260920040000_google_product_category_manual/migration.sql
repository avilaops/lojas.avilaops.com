-- O atributo é opcional e só substitui a classificação automática quando
-- confirmado para o produto. Os registros existentes permanecem automáticos.
ALTER TABLE "Produto" ADD COLUMN "googleProductCategory" TEXT;
