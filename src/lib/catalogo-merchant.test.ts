import assert from "node:assert/strict";
import test from "node:test";
import { gerarFeedMerchant } from "./catalogo-merchant";
import type { ProdutoCatalogo } from "./catalogo-qualidade";

function produto(correspondencia: "nao_confirmada" | "confirmada" | "rejeitada"): ProdutoCatalogo {
  return {
    id: "produto-1", tenantId: "loja-1", nome: "Rolamento GBR 6207", slug: "rolamento-gbr-6207",
    ativo: true, precoCentavos: 100, precoDeCentavos: null, descricao: "Rolamento rígido de esferas",
    descricaoCurta: null, marca: "GBR", sku: "6207", gtin: null, categoriaId: "categoria-1",
    googleProductCategory: null, categoria: { id: "categoria-1", tenantId: "loja-1", nome: "Rolamentos", slug: "rolamentos", ordem: 0, ativo: true, criadoEm: new Date(), atualizadoEm: new Date() },
    midias: [{ id: "midia-1", tenantId: "loja-1", produtoId: "produto-1", varianteId: null, escopo: "produto", url: "https://exemplo.com/rolamento.jpg", tipo: "imagem", finalidade: "principal", ordem: 0, origem: "propria", familia: null, textoAlternativo: null, fonte: "revisao", correspondencia, larguraPx: 800, alturaPx: 800, criadoEm: new Date() }],
    variantes: [{
      id: "variante-1", tenantId: "loja-1", produtoId: "produto-1", nome: "Única", valores: {}, sku: "6207", gtin: null,
      mpn: null, identificadoresEstado: "sem_identificador", ativo: true, padrao: true, ordem: 0,
      disponibilidade: "in_stock", versaoCatalogo: 1, criacaoEm: new Date(), atualizacaoEm: new Date(),
      preco: { id: "preco-1", tenantId: "loja-1", varianteId: "variante-1", valorCentavos: 100, comparacaoCentavos: null, moeda: "BRL", criadoEm: new Date(), atualizadoEm: new Date() },
      saldos: [{ id: "saldo-1", tenantId: "loja-1", varianteId: "variante-1", local: "principal", fisico: 3, reservado: 0, atualizadoEm: new Date() }],
      publicacoes: [],
    }],
    opcoes: [],
  } as unknown as ProdutoCatalogo;
}

test("feed mantém foto própria pendente de conferência e exclui imagem rejeitada", () => {
  const gerar = (status: "nao_confirmada" | "confirmada" | "rejeitada") => gerarFeedMerchant(
    { nome: "Vedashow", slogan: null }, "https://vedashow.com.br", [produto(status)],
  );

  assert.match(gerar("nao_confirmada"), /<g:image_link>/);
  assert.match(gerar("confirmada"), /<g:image_link>/);
  assert.doesNotMatch(gerar("rejeitada"), /<item>/);
});

test("feed só declara frete quando a loja garante frete grátis para a oferta", () => {
  const loja = { nome: "Vedashow", slogan: null };
  const semFrete = gerarFeedMerchant(loja, "https://vedashow.com.br", [produto("confirmada")]);
  assert.doesNotMatch(semFrete, /<g:shipping>/);
  const comFrete = gerarFeedMerchant(loja, "https://vedashow.com.br", [produto("confirmada")], (preco) => preco >= 100);
  assert.match(comFrete, /<g:shipping><g:country>BR<\/g:country><g:price>0\.00 BRL<\/g:price><\/g:shipping>/);
});
