import assert from "node:assert/strict";
import test from "node:test";
import { corpoDaPublicacaoMl, conteudoDoAnuncio, planejarSincronia } from "./mercadolivre-publicacao";
import { REGRAS_PADRAO } from "./canais";

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

test("as regras do canal mandam no preço, no estoque e no tipo de anúncio", () => {
  const r = corpoDaPublicacaoMl(anuncio, "https://vedashow.com.br", {
    ativo: true,
    acrescimoPercentual: 16.3,
    arredondamento: "noventa",
    estoqueReservado: 2,
    estoqueMaximo: 0,
    precoMinimoCentavos: 0,
    tipoAnuncio: "premium",
    condicao: "novo",
    garantia: "vendedor",
    garantiaMeses: 3,
  });
  // 123,45 + 16,3% = 143,57 → arredondado para cima, 143,90.
  assert.equal(r.corpo?.price, 143.9);
  assert.equal(r.corpo?.available_quantity, 5);
  assert.equal(r.corpo?.listing_type_id, "gold_pro");
  assert.deepEqual(r.corpo?.sale_terms, [
    { id: "WARRANTY_TYPE", value_name: "Garantia do vendedor" },
    { id: "WARRANTY_TIME", value_name: "3 meses" },
  ]);
});

test("garantia não respondida não inventa termo de venda", () => {
  const r = corpoDaPublicacaoMl(anuncio, "https://vedashow.com.br");
  assert.equal(r.corpo?.sale_terms, undefined);
  assert.equal(r.corpo?.listing_type_id, "gold_special");
  assert.equal(r.corpo?.condition, "new");
});

test("o preço mínimo do canal segura o produto barato antes de ele subir", () => {
  const r = corpoDaPublicacaoMl(anuncio, "https://vedashow.com.br", {
    ativo: true,
    acrescimoPercentual: 0,
    arredondamento: "nenhum",
    estoqueReservado: 0,
    estoqueMaximo: 0,
    precoMinimoCentavos: 20000,
    tipoAnuncio: "classico",
    condicao: "novo",
    garantia: "sem",
    garantiaMeses: 3,
  });
  assert.equal(r.corpo, undefined);
  assert.match(r.erro ?? "", /abaixo do mínimo/);
});

test("estoque todo reservado para a loja não publica no canal", () => {
  const r = corpoDaPublicacaoMl(anuncio, "https://vedashow.com.br", {
    ativo: true,
    acrescimoPercentual: 0,
    arredondamento: "nenhum",
    estoqueReservado: 7,
    estoqueMaximo: 0,
    precoMinimoCentavos: 0,
    tipoAnuncio: "classico",
    condicao: "novo",
    garantia: "sem",
    garantiaMeses: 3,
  });
  assert.equal(r.corpo, undefined);
  assert.match(r.erro ?? "", /reservado para a loja/);
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

/**
 * O que fazer com um anúncio já publicado. As três saídas erram em silêncio se
 * ficarem só na leitura atenta do laço.
 */
const NO_AR = { ativo: true, precoCentavos: 10000, estoque: 7 };

test("anúncio fechado no Mercado Livre não recebe mais nada", () => {
  const p = planejarSincronia(NO_AR, { status: "closed", price: 100, available_quantity: 7 }, REGRAS_PADRAO);
  assert.equal(p.acao, "pausar");
});

test("anúncio com variações para preço e estoque, e só", () => {
  // O ML recusa available_quantity no item quando há variações; insistir faria
  // todo ciclo falhar num anúncio que está perfeitamente no ar.
  const p = planejarSincronia(NO_AR, { status: "active", variations: [{ id: 1 }] }, REGRAS_PADRAO);
  assert.equal(p.acao, "so-conteudo");
});

test("fechado manda mais que variação: nada sobe para anúncio fechado", () => {
  const p = planejarSincronia(NO_AR, { status: "closed", variations: [{ id: 1 }] }, REGRAS_PADRAO);
  assert.equal(p.acao, "pausar");
});

test("o que sobe é o preço do canal, com acréscimo e arredondamento", () => {
  const p = planejarSincronia(NO_AR, { status: "active", price: 100, available_quantity: 7 }, {
    ...REGRAS_PADRAO, acrescimoPercentual: 16.3, arredondamento: "noventa",
  });
  assert.equal(p.acao === "sincronizar" && p.preco, 116.9);
  assert.equal(p.acao === "sincronizar" && p.mudouPreco, true);
});

test("nada mudou, nada sobe", () => {
  const p = planejarSincronia(NO_AR, { status: "active", price: 100, available_quantity: 7 }, REGRAS_PADRAO);
  assert.equal(p.acao === "sincronizar" && p.mudouPreco, false);
  assert.equal(p.acao === "sincronizar" && p.mudouEstoque, false);
});

test("produto inativo na loja vai a zero, que é como o ML tira do ar sem fechar", () => {
  const p = planejarSincronia({ ...NO_AR, ativo: false }, { status: "active", price: 100, available_quantity: 7 }, REGRAS_PADRAO);
  assert.equal(p.acao === "sincronizar" && p.estoque, 0);
  assert.equal(p.acao === "sincronizar" && p.mudouEstoque, true);
});

test("o estoque reservado para a loja não sobe para o canal", () => {
  const p = planejarSincronia(NO_AR, { status: "active", available_quantity: 7 }, { ...REGRAS_PADRAO, estoqueReservado: 2 });
  assert.equal(p.acao === "sincronizar" && p.estoque, 5);
});

test("produto sem preço não derruba o anúncio para R$ 0,00", () => {
  const p = planejarSincronia({ ...NO_AR, precoCentavos: 0 }, { status: "active", price: 100, available_quantity: 7 }, REGRAS_PADRAO);
  assert.equal(p.acao === "sincronizar" && p.mudouPreco, false, "preço zero não é preço");
});
