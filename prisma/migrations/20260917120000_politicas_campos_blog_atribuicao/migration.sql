-- Cinco telas que o lojista pedia e não tinha: políticas escritas por ele,
-- regras de devolução, campos personalizados do catálogo, blog da loja e
-- atribuição por canal.
--
-- Nada aqui é obrigatório para a loja que já está no ar: todas as colunas
-- entram com padrão, e loja que não mexer em nada continua publicando o modelo
-- de política da plataforma exatamente como antes.

-- ── Políticas e regras de devolução ──────────────────────────────────────
-- Vazio ('{}') quer dizer "usa o modelo da plataforma". É o estado de toda
-- loja existente, e é o certo: o texto padrão já cumpre CDC e LGPD.
ALTER TABLE "Tenant" ADD COLUMN "politicas" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Tenant" ADD COLUMN "regrasDevolucao" JSONB NOT NULL DEFAULT '{}';

-- ── Campos personalizados do catálogo ────────────────────────────────────
-- A definição é da loja (o que perguntar), o valor é do produto (a resposta).
ALTER TABLE "Tenant" ADD COLUMN "camposPersonalizados" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "Produto" ADD COLUMN "camposPersonalizados" JSONB NOT NULL DEFAULT '{}';

-- ── Blog da loja ─────────────────────────────────────────────────────────
CREATE TABLE "PublicacaoLoja" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "resumo" TEXT,
    "corpo" TEXT NOT NULL,
    "capaUrl" TEXT,
    "autor" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'rascunho',
    "publicadoEm" TIMESTAMP(3),
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PublicacaoLoja_pkey" PRIMARY KEY ("id")
);

-- O slug é único por loja, não global: duas lojas podem ter "quem-somos".
CREATE UNIQUE INDEX "PublicacaoLoja_tenantId_slug_key" ON "PublicacaoLoja"("tenantId", "slug");
-- A listagem pública sempre pergunta a mesma coisa: publicadas desta loja, da
-- mais nova para a mais antiga.
CREATE INDEX "PublicacaoLoja_tenantId_estado_publicadoEm_idx" ON "PublicacaoLoja"("tenantId", "estado", "publicadoEm");

ALTER TABLE "PublicacaoLoja" ADD CONSTRAINT "PublicacaoLoja_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── Medição de sessões da vitrine ────────────────────────────────────────
-- Sem esta tabela, Análises só sabe falar de vendas: sessão, taxa de conversão
-- e canal de origem não existem retroativamente.
CREATE TABLE "SessaoVitrine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "chave" TEXT NOT NULL,
    "visitante" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "origem" TEXT,
    "midia" TEXT,
    "campanha" TEXT,
    "termo" TEXT,
    "conteudo" TEXT,
    "referrer" TEXT,
    "entrada" TEXT NOT NULL,
    "dispositivo" TEXT NOT NULL DEFAULT 'computador',
    "paginas" INTEGER NOT NULL DEFAULT 1,
    "viuProduto" BOOLEAN NOT NULL DEFAULT false,
    "iniciouCheckout" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ultimoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SessaoVitrine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SessaoVitrine_chave_key" ON "SessaoVitrine"("chave");
CREATE INDEX "SessaoVitrine_tenantId_criadoEm_idx" ON "SessaoVitrine"("tenantId", "criadoEm");
CREATE INDEX "SessaoVitrine_tenantId_canal_criadoEm_idx" ON "SessaoVitrine"("tenantId", "canal", "criadoEm");
-- "Último clique não direto" pergunta pelas sessões anteriores deste visitante.
CREATE INDEX "SessaoVitrine_tenantId_visitante_criadoEm_idx" ON "SessaoVitrine"("tenantId", "visitante", "criadoEm");

ALTER TABLE "SessaoVitrine" ADD CONSTRAINT "SessaoVitrine_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Pedido antigo fica com sessaoId nulo, e a atribuição o conta como Direto:
-- inventar canal para quem comprou antes da medição seria relatório falso.
ALTER TABLE "Pedido" ADD COLUMN "sessaoId" TEXT;
CREATE INDEX "Pedido_sessaoId_idx" ON "Pedido"("sessaoId");
-- SET NULL, e não CASCADE: expurgar sessão velha não pode apagar pedido.
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_sessaoId_fkey"
  FOREIGN KEY ("sessaoId") REFERENCES "SessaoVitrine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
