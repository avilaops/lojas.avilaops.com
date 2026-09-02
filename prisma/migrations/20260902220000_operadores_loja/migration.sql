-- Equipe da loja no painel.
--
-- Antes era uma senha por loja: o dono, quem separa pedido e quem cadastra
-- produto usavam a mesma. Quem cria e remove aqui é o próprio lojista, pela
-- tela do painel.
--
-- O dono continua sendo Tenant.loginEmail e não entra nesta tabela: ele não
-- pode ser removido pela interface, e é o caminho de volta se a equipe se
-- trancar fora da própria loja.
CREATE TABLE "OperadorLoja" (
  "id"             TEXT NOT NULL,
  "tenantId"       TEXT NOT NULL,
  "nome"           TEXT NOT NULL,
  "email"          TEXT NOT NULL,
  "senhaHash"      TEXT NOT NULL,
  "papel"          TEXT NOT NULL DEFAULT 'OPERADOR',
  "ativo"          BOOLEAN NOT NULL DEFAULT true,
  "ultimoAcessoEm" TIMESTAMP(3),
  "criadoEm"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizadoEm"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OperadorLoja_pkey" PRIMARY KEY ("id")
);

-- O mesmo e-mail pode operar em lojas diferentes (um contador, uma agência),
-- mas nunca duas vezes na mesma loja.
CREATE UNIQUE INDEX "OperadorLoja_tenantId_email_key" ON "OperadorLoja"("tenantId", "email");
CREATE INDEX "OperadorLoja_tenantId_ativo_idx" ON "OperadorLoja"("tenantId", "ativo");

ALTER TABLE "OperadorLoja"
  ADD CONSTRAINT "OperadorLoja_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
