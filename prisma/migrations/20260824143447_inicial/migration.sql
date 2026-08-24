-- CreateEnum
CREATE TYPE "Plano" AS ENUM ('SITE', 'LOJA', 'LOJA_PRO');

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('PROVISIONANDO', 'ATIVA', 'SUSPENSA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "PedidoStatus" AS ENUM ('AGUARDANDO_PAGAMENTO', 'PAGO', 'EM_SEPARACAO', 'ENVIADO', 'ENTREGUE', 'CANCELADO', 'ESTORNADO');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "plano" "Plano" NOT NULL DEFAULT 'LOJA',
    "status" "TenantStatus" NOT NULL DEFAULT 'PROVISIONANDO',
    "dominios" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "dominioPrincipal" TEXT,
    "logoUrl" TEXT,
    "tema" JSONB NOT NULL DEFAULT '{}',
    "slogan" TEXT,
    "sobre" TEXT,
    "whatsapp" TEXT,
    "telefone" TEXT,
    "emailContato" TEXT,
    "instagram" TEXT,
    "endereco" JSONB,
    "horario" TEXT,
    "cepOrigem" TEXT,
    "retiradaNaLoja" BOOLEAN NOT NULL DEFAULT true,
    "despachoDiasUteis" INTEGER NOT NULL DEFAULT 1,
    "caixaPadrao" JSONB NOT NULL DEFAULT '{"altura":15,"largura":20,"comprimento":25}',
    "pesoPadraoKg" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "tabelaFrete" JSONB NOT NULL DEFAULT '[]',
    "freteGratisAcima" INTEGER,
    "mpPublicKey" TEXT,
    "mpAccessTokenEnc" TEXT,
    "mpWebhookSecretEnc" TEXT,
    "meiosPagamento" TEXT[] DEFAULT ARRAY['pix', 'cartao', 'boleto']::TEXT[],
    "emailRemetente" TEXT,
    "gtmId" TEXT,
    "provisionamento" JSONB NOT NULL DEFAULT '{}',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Categoria" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "descricao" TEXT,
    "imagemUrl" TEXT,
    "ordem" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Produto" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "categoriaId" TEXT,
    "slug" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "marca" TEXT,
    "sku" TEXT,
    "gtin" TEXT,
    "precoCentavos" INTEGER NOT NULL,
    "precoDeCentavos" INTEGER,
    "descricaoCurta" TEXT,
    "descricao" TEXT,
    "imagens" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "destaque" BOOLEAN NOT NULL DEFAULT false,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "disponibilidade" TEXT NOT NULL DEFAULT 'in_stock',
    "estoque" INTEGER,
    "pesoKg" DOUBLE PRECISION,
    "alturaCm" DOUBLE PRECISION,
    "larguraCm" DOUBLE PRECISION,
    "comprimentoCm" DOUBLE PRECISION,
    "atributos" JSONB NOT NULL DEFAULT '{}',
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Produto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pedido" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "status" "PedidoStatus" NOT NULL DEFAULT 'AGUARDANDO_PAGAMENTO',
    "clienteNome" TEXT NOT NULL,
    "clienteEmail" TEXT NOT NULL,
    "clienteTelefone" TEXT NOT NULL,
    "clienteDocumento" TEXT NOT NULL,
    "entrega" JSONB,
    "freteNome" TEXT NOT NULL,
    "freteCentavos" INTEGER NOT NULL,
    "subtotalCentavos" INTEGER NOT NULL,
    "descontoCentavos" INTEGER NOT NULL DEFAULT 0,
    "totalCentavos" INTEGER NOT NULL,
    "meioPagamento" TEXT NOT NULL,
    "gateway" TEXT NOT NULL DEFAULT 'mercadopago',
    "pagamentoId" TEXT,
    "pagamentoStatus" TEXT,
    "rastreio" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pedido_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PedidoItem" (
    "id" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "produtoId" TEXT,
    "nome" TEXT NOT NULL,
    "sku" TEXT,
    "quantidade" INTEGER NOT NULL,
    "precoUnitarioCentavos" INTEGER NOT NULL,

    CONSTRAINT "PedidoItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE INDEX "Tenant_status_idx" ON "Tenant"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Categoria_tenantId_slug_key" ON "Categoria"("tenantId", "slug");

-- CreateIndex
CREATE INDEX "Produto_tenantId_ativo_destaque_idx" ON "Produto"("tenantId", "ativo", "destaque");

-- CreateIndex
CREATE UNIQUE INDEX "Produto_tenantId_slug_key" ON "Produto"("tenantId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "Pedido_referencia_key" ON "Pedido"("referencia");

-- CreateIndex
CREATE INDEX "Pedido_tenantId_status_idx" ON "Pedido"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Pedido_pagamentoId_idx" ON "Pedido"("pagamentoId");

-- AddForeignKey
ALTER TABLE "Categoria" ADD CONSTRAINT "Categoria_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Produto" ADD CONSTRAINT "Produto_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Pedido" ADD CONSTRAINT "Pedido_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PedidoItem" ADD CONSTRAINT "PedidoItem_produtoId_fkey" FOREIGN KEY ("produtoId") REFERENCES "Produto"("id") ON DELETE SET NULL ON UPDATE CASCADE;
