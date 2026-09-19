import assert from "node:assert/strict";
import test from "node:test";
import { corpoDaPublicacaoMl, conteudoDoAnuncio } from "./mercadolivre-publicacao";

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
    imagemOrigem: "propria",
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

/**
 * Sincronização de conteúdo: o anúncio nascia sem descrição (ela vive em
 * endpoint próprio do ML) e, depois de publicado, só preço e estoque subiam —
 * foto trocada e nome corrigido na loja nunca chegavam lá.
 */
test("o conteúdo do anúncio sai do catálogo, com a descrição em texto puro", () => {
  const c = conteudoDoAnuncio(
    {
      id: "a1",
      categoriaMl: "MLB1234",
      preparo: { produtoId: "p1", nomeOriginal: "Cera", nomeEnriquecido: "Cera de carnaúba 500ml", estado: "PRONTO", presentes: [] },
      produto: {
        id: "p1", nome: "Cera", precoCentavos: 6495, estoque: 4, ativo: true,
        imagens: ["/uploads/cera.webp"],
        descricaoCurta: "curta",
        descricao: "<p>Protege a pintura por <strong>três meses</strong>.</p>",
      },
    } as never,
    "https://loja.exemplo",
  )!;
  assert.equal(c.title, "Cera de carnaúba 500ml");
  assert.deepEqual(c.pictures, [{ source: "https://loja.exemplo/uploads/cera.webp" }]);
  assert.equal(c.descricao, "Protege a pintura por três meses.", "o ML mostra HTML como texto visível");
  assert.equal(c.hash.length, 16);
});

test("a impressão digital só muda quando o conteúdo muda", () => {
  const base = {
    id: "a1", categoriaMl: "MLB1", preparo: { produtoId: "p1", nomeOriginal: "x", nomeEnriquecido: "Nome do produto", estado: "PRONTO", presentes: [] },
    produto: { id: "p1", nome: "x", precoCentavos: 1000, estoque: 1, ativo: true, imagens: ["/a.webp"], descricaoCurta: null, descricao: "Texto" },
  } as never;
  const a = conteudoDoAnuncio(base, "https://loja.exemplo")!;
  // Preço e estoque não entram na impressão: quem cuida deles é o outro caminho.
  const so_preco = conteudoDoAnuncio({ ...(base as object), produto: { ...(base as { produto: object }).produto, precoCentavos: 9999, estoque: 50 } } as never, "https://loja.exemplo")!;
  assert.equal(so_preco.hash, a.hash);
  const outra_foto = conteudoDoAnuncio({ ...(base as object), produto: { ...(base as { produto: object }).produto, imagens: ["/b.webp"] } } as never, "https://loja.exemplo")!;
  assert.notEqual(outra_foto.hash, a.hash);
  const outro_texto = conteudoDoAnuncio({ ...(base as object), produto: { ...(base as { produto: object }).produto, descricao: "Texto novo" } } as never, "https://loja.exemplo")!;
  assert.notEqual(outro_texto.hash, a.hash);
});

test("sem preparo, sem título ou sem foto pública não há conteúdo a mandar", () => {
  const produto = { id: "p1", nome: "x", precoCentavos: 1000, estoque: 1, ativo: true, imagens: [], descricaoCurta: null, descricao: null };
  assert.equal(conteudoDoAnuncio({ id: "a", categoriaMl: "MLB1", preparo: null, produto } as never, "https://loja.exemplo"), null);
  assert.equal(
    conteudoDoAnuncio({ id: "a", categoriaMl: "MLB1", preparo: { produtoId: "p1", nomeOriginal: "x", nomeEnriquecido: "Nome", estado: "PRONTO", presentes: [] }, produto } as never, "https://loja.exemplo"),
    null,
    "produto sem imagem válida não tem o que publicar",
  );
});

/**
 * A loja avisa quando a foto é da série ou uma ilustração; o anúncio precisa
 * avisar também. Lá a expectativa errada não vira devolução: vira reclamação,
 * mediação e reputação.
 */
const comOrigem = (imagemOrigem: string, descricao: string | null = "Texto do lojista.") =>
  conteudoDoAnuncio(
    {
      id: "a1", categoriaMl: "MLB1",
      preparo: { produtoId: "p1", nomeOriginal: "x", nomeEnriquecido: "Rolamento 6205", estado: "PRONTO", presentes: [] },
      produto: { id: "p1", nome: "x", precoCentavos: 1000, estoque: 1, ativo: true, imagens: ["/a.webp"], descricaoCurta: null, descricao, imagemOrigem },
    } as never,
    "https://loja.exemplo",
  )!;

test("foto da série e ilustração se declaram no anúncio, antes do texto de venda", () => {
  const serie = comOrigem("representativa").descricao;
  assert.match(serie, /^Imagem representativa da série/, "ressalva depois do argumento é ressalva que ninguém lê");
  assert.match(serie, /Texto do lojista\.$/);
  assert.match(comOrigem("ilustracao").descricao, /^Ilustração técnica/);
});

test("foto do próprio item não acrescenta nada", () => {
  assert.equal(comOrigem("propria").descricao, "Texto do lojista.");
  // Produto sem descrição e com foto própria continua sem descrição: o
  // caminho da escrita pula o endpoint quando não há texto.
  assert.equal(comOrigem("propria", null).descricao, "");
});

test("declarar a origem muda a impressão digital, então anúncio antigo se corrige sozinho", () => {
  assert.notEqual(comOrigem("representativa").hash, comOrigem("propria").hash);
});
