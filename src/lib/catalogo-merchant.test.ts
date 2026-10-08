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

test("a descrição do feed é a da página: curta e longa, em texto puro, nessa ordem", () => {
  const p = produto("confirmada");
  Object.assign(p, { descricaoCurta: "Rolamento rígido de esferas, vedação 2RS.", descricao: "<p>Serve em <b>motores</b> e redutores.</p><p>Medidas: 35 x 72 x 17 mm.</p>" });
  const feed = gerarFeedMerchant({ nome: "Vedashow", slogan: null }, "https://vedashow.com.br", [p]);
  assert.match(feed, /<g:description>Rolamento rígido de esferas, vedação 2RS\.\n\nServe em motores e redutores\.\n\nMedidas: 35 x 72 x 17 mm\.<\/g:description>/);
  // Curta igual ao começo da longa não sai duas vezes.
  Object.assign(p, { descricaoCurta: "Serve em motores", descricao: "Serve em motores e redutores." });
  assert.match(gerarFeedMerchant({ nome: "Vedashow", slogan: null }, "https://vedashow.com.br", [p]), /<g:description>Serve em motores e redutores\.<\/g:description>/);
});

test("a ficha técnica visível vira product_detail; chave interna não sai", () => {
  const p = produto("confirmada");
  Object.assign(p, { atributos: { diametroInternoMm: 35, volumeMl: 500, _catalogoFonte: "erp", grupoLegado: "X" } });
  const feed = gerarFeedMerchant({ nome: "Vedashow", slogan: null }, "https://vedashow.com.br", [p]);
  assert.match(feed, /<g:product_detail><g:section_name>Especificações<\/g:section_name><g:attribute_name>Diâmetro interno<\/g:attribute_name><g:attribute_value>35 mm<\/g:attribute_value><\/g:product_detail>/);
  assert.match(feed, /<g:attribute_name>Volume \(ml\)<\/g:attribute_name><g:attribute_value>500<\/g:attribute_value>/);
  assert.doesNotMatch(feed, /catalogoFonte|grupoLegado/);
});

test("volume cadastrado vira preço por litro; sem volume não sai nada", () => {
  const loja = { nome: "Brilhax", slogan: null };
  const p = produto("confirmada");
  Object.assign(p, { atributos: { volumeMl: 500 } });
  assert.match(gerarFeedMerchant(loja, "https://brilhax.com", [p]), /<g:unit_pricing_measure>500ml<\/g:unit_pricing_measure><g:unit_pricing_base_measure>1l<\/g:unit_pricing_base_measure>/);
  Object.assign(p, { atributos: { volumeMl: "1500" } });
  assert.match(gerarFeedMerchant(loja, "https://brilhax.com", [p]), /<g:unit_pricing_measure>1\.5l<\/g:unit_pricing_measure>/);
  Object.assign(p, { atributos: { volumeMl: "abc" } });
  assert.doesNotMatch(gerarFeedMerchant(loja, "https://brilhax.com", [p]), /unit_pricing/);
});

test("ilustração de família só entra no feed nos ramos em que o Google a aceita", () => {
  const gerar = (googleProductCategory: string) => {
    const p = produto("confirmada");
    const midia = (p.midias as unknown as Array<Record<string, unknown>>)[0];
    Object.assign(midia, { origem: "representativa", familia: "Gaxeta PU - Tipo B" });
    Object.assign(p, { googleProductCategory, categoria: null, categoriaId: null });
    return gerarFeedMerchant({ nome: "PK Vedações", slogan: null }, "https://pkvedacoes.com.br", [p]);
  };
  // 6732: Ferragens > Encanamento > Juntas e conexões > Anéis de vedação.
  assert.match(gerar("6732"), /<item>.*<g:google_product_category>6732</);
  // 111 (Comercial e industrial) fica fora da exceção e continua exigindo foto.
  assert.doesNotMatch(gerar("111"), /<item>/);
});
