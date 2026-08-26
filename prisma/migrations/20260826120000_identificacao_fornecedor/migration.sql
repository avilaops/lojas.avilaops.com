-- Identificação do fornecedor exigida pelo Decreto 7.962/2013, art. 2º:
-- razão social, CNPJ e endereço têm que aparecer em local de destaque.
ALTER TABLE "Tenant" ADD COLUMN "razaoSocial" TEXT;
ALTER TABLE "Tenant" ADD COLUMN "cnpj" TEXT;
