-- Etiqueta de envio emitida pela carteira da Avila Ops.
--
-- Cada linha é dinheiro que saiu da nossa conta para despachar o pedido de um
-- lojista. O comprador já pagou o frete para ELE; esta tabela é o que a gente
-- tem a receber de volta. Emitir sem registrar seria financiar loja sem saber.
CREATE TABLE "Postagem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "pedidoId" TEXT NOT NULL,
    "servico" TEXT NOT NULL,
    "codigoObjeto" TEXT,
    "custoCentavos" INTEGER NOT NULL,
    "cobradoDoCompradorCentavos" INTEGER NOT NULL,
    "pdfEtiqueta" TEXT,
    "pdfDeclaracao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pendente',
    "detalhe" TEXT,
    "acertadaEm" TIMESTAMP(3),
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Postagem_pkey" PRIMARY KEY ("id")
);

-- Uma etiqueta por pedido: clicar duas vezes no botão não pode gerar dois envios.
CREATE UNIQUE INDEX "Postagem_pedidoId_key" ON "Postagem"("pedidoId");
CREATE INDEX "Postagem_tenantId_acertadaEm_idx" ON "Postagem"("tenantId", "acertadaEm");
ALTER TABLE "Postagem" ADD CONSTRAINT "Postagem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Postagem" ADD CONSTRAINT "Postagem_pedidoId_fkey" FOREIGN KEY ("pedidoId") REFERENCES "Pedido"("id") ON DELETE CASCADE ON UPDATE CASCADE;
