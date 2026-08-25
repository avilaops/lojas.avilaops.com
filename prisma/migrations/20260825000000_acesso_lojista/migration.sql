-- Acesso do lojista ao painel (lojas.avilaops.com/painel)
ALTER TABLE "Tenant" ADD COLUMN "loginEmail" TEXT, ADD COLUMN "senhaHash" TEXT;
CREATE UNIQUE INDEX "Tenant_loginEmail_key" ON "Tenant"("loginEmail");
