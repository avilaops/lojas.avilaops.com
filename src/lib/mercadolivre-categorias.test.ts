import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import {
  CategoriaInvalida,
  ProdutoNaoEncontrado,
  buscarCategorias,
  definirCategoriaManual,
  detalharCategoria,
  preparoNaCategoria,
  type ProdutoParaEscolha,
  type RepositorioCategoria,
} from "./mercadolivre-categorias";
import { categoriaEscolhidaAMao, limparCache, prepararComCategoria } from "./mercadolivre-preparo";

/**
 * A escolha manual de categoria, contra respostas reais da API pública do
 * Mercado Livre capturadas em 19/09/2026.
 *
 * Determinístico de propósito: o build não depende de a rede estar de pé. O que
 * está preso aqui é o que não dá para descobrir em produção sem prejuízo — a
 * escolha do lojista sobrevivendo ao preditor, e o Mercado Livre fora do ar não
 * apagando o que já estava certo.
 */

/** `GET /categories/{id}` — público, sem `Authorization`. */
const CATEGORIAS: Record<string, { id: string; name: string; path_from_root: Array<{ id: string; name: string }>; children_categories: Array<{ id: string; name: string }> }> = {
  // Folha: publicável.
  MLB455028: {
    id: "MLB455028",
    name: "Esferas de Rolamento",
    path_from_root: [
      { id: "MLB5672", name: "Acessórios para Veículos" },
      { id: "MLB22693", name: "Peças" },
      { id: "MLB455028", name: "Esferas de Rolamento" },
    ],
    children_categories: [],
  },
  MLB375065: {
    id: "MLB375065",
    name: "Retentores",
    path_from_root: [
      { id: "MLB5672", name: "Acessórios para Veículos" },
      { id: "MLB375065", name: "Retentores" },
    ],
    children_categories: [],
  },
  // Meio de árvore: o ML não publica aqui.
  MLB22693: {
    id: "MLB22693",
    name: "Peças",
    path_from_root: [
      { id: "MLB5672", name: "Acessórios para Veículos" },
      { id: "MLB22693", name: "Peças" },
    ],
    children_categories: [
      { id: "MLB455028", name: "Esferas de Rolamento" },
      { id: "MLB375065", name: "Retentores" },
      { id: "MLB439169", name: "Correia de Transmissão" },
    ],
  },
  MLB269718: {
    id: "MLB269718",
    name: "Águas Minerais",
    path_from_root: [
      { id: "MLB1403", name: "Alimentos e Bebidas" },
      { id: "MLB269718", name: "Águas Minerais" },
    ],
    children_categories: [],
  },
};

const ATRIBUTOS: Record<string, Array<{ id: string; name: string; tags: Record<string, boolean> }>> = {
  MLB455028: [
    { id: "BRAND", name: "Marca", tags: { required: true } },
    { id: "MATERIAL", name: "Material", tags: { required: true } },
    { id: "GTIN", name: "Código universal de produto", tags: { conditional_required: true } },
  ],
  MLB375065: [{ id: "BRAND", name: "Marca", tags: { required: true } }],
  MLB269718: [{ id: "BRAND", name: "Marca", tags: { required: true } }],
};

const BUSCA: Record<string, Array<{ category_id: string; category_name: string; domain_id: string; domain_name: string }>> = {
  rolamento: [
    { category_id: "MLB455028", category_name: "Esferas de Rolamento", domain_id: "d", domain_name: "Esferas de rolamento" },
    { category_id: "MLB269718", category_name: "Águas Minerais", domain_id: "d", domain_name: "Águas minerais" },
  ],
  "agua mineral": [
    { category_id: "MLB269718", category_name: "Águas Minerais", domain_id: "d", domain_name: "Águas minerais" },
  ],
};

let autorizacoes = 0;
let falharRede = false;
const original = globalThis.fetch;

globalThis.fetch = (async (entrada: RequestInfo | URL, init?: RequestInit) => {
  const url = String(entrada);
  if (falharRede) throw new Error("ECONNRESET");
  // Nenhuma chamada desta tela pode levar token: o lojista organiza o catálogo
  // antes de conectar conta nenhuma.
  if (new Headers(init?.headers ?? {}).has("authorization")) autorizacoes++;

  const atributos = url.match(/categories\/(MLB\d+)\/attributes/);
  if (atributos) return Response.json(ATRIBUTOS[atributos[1]] ?? []);

  const detalhe = url.match(/categories\/(MLB\d+)(?:\?|$)/);
  if (detalhe) {
    const c = CATEGORIAS[detalhe[1]];
    return c ? Response.json(c) : new Response("not found", { status: 404 });
  }

  if (url.includes("domain_discovery/search")) {
    const q = decodeURIComponent(new URL(url).searchParams.get("q") ?? "").toLowerCase();
    return Response.json(BUSCA[q] ?? []);
  }
  return original(entrada as RequestInfo);
}) as typeof fetch;

afterEach(() => {
  limparCache();
  autorizacoes = 0;
  falharRede = false;
});

const produto = (p: Partial<ProdutoParaEscolha> = {}): ProdutoParaEscolha => ({
  id: p.id ?? "p1",
  nome: p.nome ?? "ROL. 6205 2RS",
  marca: p.marca ?? null,
  sku: p.sku ?? null,
  gtin: p.gtin ?? null,
  atributos: p.atributos ?? {},
});

// ── Busca e navegação ────────────────────────────────────────────────────

test("a busca de categoria não manda token: organizar catálogo não exige OAuth", async () => {
  const r = await buscarCategorias("rolamento");
  assert.ok(r.length > 0);
  assert.equal(autorizacoes, 0);
});

test("a busca mostra o caminho inteiro, porque o nome sozinho não distingue", async () => {
  const [primeira] = await buscarCategorias("rolamento");
  assert.equal(primeira.categoriaId, "MLB455028");
  assert.deepEqual(primeira.caminho, ["Acessórios para Veículos", "Peças", "Esferas de Rolamento"]);
  assert.equal(primeira.folha, true);
});

test("o coringa cai quando não casa com o texto, e fica quando é o que se procurou", async () => {
  const rolamento = await buscarCategorias("rolamento");
  assert.ok(!rolamento.some((c) => c.categoriaId === "MLB269718"), "água mineral não é resposta para rolamento");

  // Quem vende água mineral digita "agua mineral": some-la seria esconder
  // justamente o que a pessoa procurou.
  const agua = await buscarCategorias("agua mineral");
  assert.ok(agua.some((c) => c.categoriaId === "MLB269718"));
});

test("busca curta demais não vai à rede", async () => {
  assert.deepEqual(await buscarCategorias("ro"), []);
});

test("dá para descer pelas filhas de uma categoria de agrupamento", async () => {
  const pecas = await detalharCategoria("MLB22693");
  assert.equal(pecas?.folha, false);
  assert.equal(pecas?.filhas.length, 3);
  assert.ok(pecas?.filhas.some((f) => f.categoriaId === "MLB455028"));
});

// ── Escolha manual e recálculo ───────────────────────────────────────────

test("escolher categoria recalcula os atributos e diz o que ainda falta", async () => {
  const { preparo, categoria } = await preparoNaCategoria(produto(), "MLB455028");
  assert.equal(categoria.categoriaId, "MLB455028");
  assert.equal(preparo.origemCategoria, "manual");
  assert.equal(preparo.confianca, "alta");
  assert.equal(preparo.estado, "BLOQUEADO");
  // Marca e material bloqueiam; GTIN é condicional e só reduz alcance.
  assert.deepEqual(preparo.faltando.map((f) => f.id).sort(), ["BRAND", "GTIN", "MATERIAL"]);
  assert.ok(preparo.pendencias.some((p) => p.toLowerCase().includes("marca")));
});

test("com tudo preenchido, a escolha manual deixa o produto pronto", async () => {
  const { preparo } = await preparoNaCategoria(
    produto({ marca: "FAG", gtin: "7891234567895", atributos: { material: "Aço cromo" } }),
    "MLB455028",
  );
  assert.equal(preparo.estado, "PRONTO");
  assert.deepEqual(preparo.faltando, []);
  assert.deepEqual(preparo.pendencias, []);
});

test("atributo obrigatório faltando mantém o bloqueio, mesmo com a categoria certa", async () => {
  // Escolher a categoria certa não dispensa informar a marca: publicar assim é
  // o ML recusando depois, com a reputação do lojista no meio.
  const { preparo } = await preparoNaCategoria(produto({ gtin: "7891234567895", atributos: { material: "Aço" } }), "MLB455028");
  assert.equal(preparo.estado, "BLOQUEADO");
  assert.deepEqual(preparo.faltando.map((f) => f.id), ["BRAND"]);
});

test("categoria de agrupamento é recusada, e o erro diz para onde descer", async () => {
  await assert.rejects(
    () => preparoNaCategoria(produto(), "MLB22693"),
    (e: Error) => e instanceof CategoriaInvalida && /Esferas de Rolamento/.test(e.message),
  );
});

test("categoria inexistente e código fora do padrão são recusados", async () => {
  await assert.rejects(() => preparoNaCategoria(produto(), "MLB999999"), CategoriaInvalida);
  await assert.rejects(() => preparoNaCategoria(produto(), "banana"), CategoriaInvalida);
});

// ── Persistência: a escolha é palavra final ──────────────────────────────

test("o preditor não sobrescreve escolha manual, e continua mandando na automática", () => {
  assert.equal(categoriaEscolhidaAMao({ categoriaMl: "MLB455028", categoriaOrigem: "manual" }), "MLB455028");
  assert.equal(categoriaEscolhidaAMao({ categoriaMl: "MLB455028", categoriaOrigem: "automatica" }), null);
  assert.equal(categoriaEscolhidaAMao({ categoriaMl: null, categoriaOrigem: "manual" }), null);
  assert.equal(categoriaEscolhidaAMao(undefined), null);
});

test("repreparar um produto de categoria manual não chama o preditor", async () => {
  let previsoes = 0;
  const anterior = globalThis.fetch;
  globalThis.fetch = (async (e: RequestInfo | URL, i?: RequestInit) => {
    if (String(e).includes("domain_discovery/search")) previsoes++;
    return anterior(e as RequestInfo, i);
  }) as typeof fetch;
  try {
    const r = await prepararComCategoria({
      produto: produto({ marca: "FAG" }),
      categoria: { categoriaId: "MLB375065", categoriaNome: "Retentores", dominioNome: "Acessórios para Veículos", caminho: ["Acessórios para Veículos", "Retentores"] },
    });
    assert.equal(previsoes, 0);
    assert.equal(r.estado, "PRONTO");
    assert.equal(r.categoria?.categoriaId, "MLB375065");
  } finally {
    globalThis.fetch = anterior;
  }
});

// ── Gravação: tenant, troca e falha de rede ──────────────────────────────

function repoFalso() {
  const produtos = new Map<string, ProdutoParaEscolha & { grupo: string | null }>([
    ["loja-a:p1", { ...produto({ id: "p1", marca: "FAG" }), grupo: "ROLAMENTO" }],
    ["loja-b:p9", { ...produto({ id: "p9" }), grupo: null }],
  ]);
  const gravados: Array<{ tenantId: string; produtoId: string; categoriaId: string; estado: string }> = [];
  const repo: RepositorioCategoria = {
    async acharProduto(tenantId, produtoId) {
      return produtos.get(`${tenantId}:${produtoId}`) ?? null;
    },
    async gravar(tenantId, produtoId, { categoriaId, preparo }) {
      gravados.push({ tenantId, produtoId, categoriaId, estado: preparo.estado });
    },
  };
  return { repo, gravados };
}

test("uma loja não define categoria no produto de outra", async () => {
  const { repo, gravados } = repoFalso();
  await assert.rejects(() => definirCategoriaManual("loja-b", "p1", "MLB375065", repo), ProdutoNaoEncontrado);
  assert.equal(gravados.length, 0, "nada pode ser gravado quando o produto não é da loja");

  // A mesma chamada, pela loja dona, funciona.
  await definirCategoriaManual("loja-a", "p1", "MLB375065", repo);
  assert.equal(gravados.length, 1);
  assert.equal(gravados[0].tenantId, "loja-a");
});

test("trocar a categoria manual depois grava a nova e rediagnostica", async () => {
  const { repo, gravados } = repoFalso();
  const primeira = await definirCategoriaManual("loja-a", "p1", "MLB375065", repo);
  assert.equal(primeira.preparo.estado, "PRONTO");

  const segunda = await definirCategoriaManual("loja-a", "p1", "MLB455028", repo);
  // Retentores só pedia marca; Esferas de Rolamento pede material também.
  assert.equal(segunda.preparo.estado, "BLOQUEADO");
  assert.deepEqual(gravados.map((g) => g.categoriaId), ["MLB375065", "MLB455028"]);
  assert.deepEqual(gravados.map((g) => g.estado), ["PRONTO", "BLOQUEADO"]);
});

test("Mercado Livre fora do ar não apaga a categoria já salva", async () => {
  const { repo, gravados } = repoFalso();
  await definirCategoriaManual("loja-a", "p1", "MLB375065", repo);
  assert.equal(gravados.length, 1);

  limparCache();
  falharRede = true;
  await assert.rejects(() => definirCategoriaManual("loja-a", "p1", "MLB455028", repo), /ECONNRESET/);
  // A gravação acontece depois da consulta: falhar antes dela deixa o banco
  // exatamente como estava, com a categoria anterior de pé.
  assert.equal(gravados.length, 1);
  assert.equal(gravados[0].categoriaId, "MLB375065");
});
