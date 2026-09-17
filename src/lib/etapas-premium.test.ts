import { test } from "node:test";
import assert from "node:assert/strict";
import { categoriaPorPictograma, etapasDoPremium, iconeDaCategoria } from "./etapas-premium";
import { TemaSchema } from "./tema";

const cat = (slug: string, nome: string) => ({ id: slug, slug, nome });

const CATALOGO = [
  cat("lavagem-automotiva", "Lavagem automotiva"),
  cat("descontaminacao", "Descontaminação"),
  cat("polimento-e-correcao", "Polimento e correção"),
  cat("ceras-e-selantes", "Ceras e selantes"),
  cat("acessorios", "Acessórios e microfibras"),
];

test("sem etapas escritas, a home do premium sai da trilha do próprio catálogo", () => {
  const etapas = etapasDoPremium(undefined, CATALOGO);
  assert.deepEqual(etapas.map((e) => e.categoria), [
    "lavagem-automotiva",
    "descontaminacao",
    "polimento-e-correcao",
    "ceras-e-selantes",
  ]);
  assert.deepEqual(etapas.map((e) => e.icone), ["lavagem", "acessorios", "polimento", "protecao"]);
});

test("o que o lojista escreveu vale sempre, na ordem dele", () => {
  const premium = {
    etapas: [
      { categoria: "acessorios", titulo: "Comece pelo pano certo", texto: "Microfibra boa não risca.", icone: "acessorios" as const },
      { categoria: "lavagem-automotiva", titulo: "Depois lave", texto: "Shampoo neutro.", icone: "lavagem" as const },
    ],
  };
  assert.deepEqual(etapasDoPremium(premium, CATALOGO).map((e) => e.titulo), ["Comece pelo pano certo", "Depois lave"]);
});

test("etapa que aponta para categoria apagada não vai para a tela", () => {
  const premium = { etapas: [{ categoria: "categoria-que-foi-apagada", titulo: "Fantasma", texto: "", icone: "kits" as const }] };
  // Sobrou nada de escrito: cai na trilha em vez de deixar a seção vazia.
  assert.deepEqual(etapasDoPremium(premium, CATALOGO).length, 4);
  assert.deepEqual(etapasDoPremium(premium, [cat("kits", "Kits")]), []);
});

test("uma etapa reconhecida só não vira sequência", () => {
  assert.deepEqual(etapasDoPremium(undefined, [cat("lavagem", "Lavagem"), cat("brindes", "Brindes")]), []);
});

test("catálogo sem vocabulário automotivo não inventa etapa", () => {
  assert.deepEqual(etapasDoPremium(undefined, [cat("camisetas", "Camisetas"), cat("canecas", "Canecas")]), []);
});

test("a etapa gerada continua válida para o schema do tema", () => {
  const tema = TemaSchema.parse({ layout: "automotivo-premium", premium: { etapas: etapasDoPremium(undefined, CATALOGO) } });
  assert.equal(tema.premium?.etapas?.length, 4);
});

test("o pictograma da categoria sai do nome, não do slug exato", () => {
  assert.equal(iconeDaCategoria("Lavagem automotiva", "lavagem-automotiva"), "lavagem");
  assert.equal(iconeDaCategoria("Vitrificação cerâmica", "vitrificacao-ceramica"), "vitrificacao");
  assert.equal(iconeDaCategoria("Ceras e selantes", "ceras-e-selantes"), "protecao");
  assert.equal(iconeDaCategoria("Kit de polimento", "kit-de-polimento"), "kits");
  assert.equal(iconeDaCategoria("Capacetes", "capacetes"), "moto");
  assert.equal(iconeDaCategoria("Brindes", "brindes"), "protecao");
  assert.equal(iconeDaCategoria(null, undefined), "protecao");
});

test("o bloco de acessórios aponta para a categoria da loja, ou para lugar nenhum", () => {
  assert.equal(categoriaPorPictograma("acessorios", CATALOGO)?.slug, "acessorios");
  assert.equal(categoriaPorPictograma("acessorios", [cat("ceras", "Ceras")]), null);
});
