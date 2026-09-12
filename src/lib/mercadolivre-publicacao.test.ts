import assert from "node:assert/strict";
import test from "node:test";
import { corpoDaPublicacaoMl } from "./mercadolivre-publicacao";

const pronto = {
  produtoId: "p1",
  nomeOriginal: "ROL. 6205 2RS",
  nomeEnriquecido: "Rolamento rígido de esferas 6205 2RS GBR",
  aplicou: [],
  categoria: { categoriaId: "MLB123", categoriaNome: "Rolamentos", dominioNome: "Rolamentos" },
  alternativas: [],
  confianca: "alta",
  motivos: [],
  presentes: [
    { id: "BRAND", nome: "Marca", exigencia: "required", valor: "GBR", origem: "marca" },
    { id: "PART_NUMBER", nome: "Código", exigencia: "required", valor: "6205-2RS", origem: "sku" },
  ],
  faltando: [],
  naoInferiveis: [],
  estado: "PRONTO",
  pendencias: [],
} as const;

const anuncio = {
  id: "a1",
  categoriaMl: "MLB123",
  preparo: pronto,
  produto: {
    id: "p1",
    nome: "ROL. 6205 2RS",
    precoCentavos: 12345,
    estoque: 7,
    imagens: ["/uploads/6205.webp", "javascript:alert(1)"],
    descricaoCurta: null,
    descricao: null,
    ativo: true,
  },
};

test("monta publicação apenas com dados reais do preparo", () => {
  const r = corpoDaPublicacaoMl(anuncio, "https://vedashow.com.br");
  assert.equal(r.erro, undefined);
  assert.equal(r.corpo?.price, 123.45);
  assert.equal(r.corpo?.available_quantity, 7);
  assert.deepEqual(r.corpo?.pictures, [{ source: "https://vedashow.com.br/uploads/6205.webp" }]);
  assert.deepEqual(r.corpo?.attributes, [
    { id: "BRAND", value_name: "GBR" },
    { id: "PART_NUMBER", value_name: "6205-2RS" },
  ]);
});

test("recusa publicar sem foto, preço, estoque ou preparo PRONTO", () => {
  assert.match(corpoDaPublicacaoMl({ ...anuncio, produto: { ...anuncio.produto, imagens: [] } }, "https://vedashow.com.br").erro ?? "", /imagem/);
  assert.match(corpoDaPublicacaoMl({ ...anuncio, produto: { ...anuncio.produto, precoCentavos: 0 } }, "https://vedashow.com.br").erro ?? "", /preço/);
  assert.match(corpoDaPublicacaoMl({ ...anuncio, produto: { ...anuncio.produto, estoque: 0 } }, "https://vedashow.com.br").erro ?? "", /estoque/);
  assert.match(corpoDaPublicacaoMl({ ...anuncio, preparo: { ...pronto, estado: "REVISAO" } }, "https://vedashow.com.br").erro ?? "", /PRONTO/);
});
