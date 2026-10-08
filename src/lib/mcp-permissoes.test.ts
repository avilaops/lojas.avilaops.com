import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ESCOPOS, ESCOPOS_SECRETA, ehEscopo } from "./api-chaves";
import { alvoDaChamada } from "./mcp-historico";
import { AREAS, ESCOPO_DO_CONECTOR, ESCOPOS_DO_MCP, FERRAMENTAS, anotacoes, escoposDaAutorizacao, ferramentaAltera, podeUsar, resumoDoAcesso } from "./mcp-permissoes";

/**
 * O que cada conexão do conector pode. Cada teste é um jeito de um assistente
 * alterar a loja sem o lojista ter autorizado, ou de o histórico guardar o que
 * não devia.
 */

// Os nomes saem do fonte, e não de um `import`, porque `mcp-tools.ts` puxa o
// Prisma e este teste roda sem banco.
const nomesNoFonte = [...readFileSync("src/lib/mcp-tools.ts", "utf8").matchAll(/^\s{4}name: "([a-z_]+)",$/gm)].map((m) => m[1]);

test("toda ferramenta do conector tem escopo declarado, e não sobra escopo de ferramenta que não existe", () => {
  assert.ok(nomesNoFonte.length >= 26, `só ${nomesNoFonte.length} ferramentas lidas do fonte`);
  assert.deepEqual([...nomesNoFonte].sort(), Object.keys(FERRAMENTAS).sort());
});

test("todo escopo de ferramenta existe no catálogo e pode ir numa chave secreta", () => {
  for (const [nome, f] of Object.entries(FERRAMENTAS)) {
    assert.ok(ehEscopo(f.escopo), `${nome}: ${f.escopo}`);
    assert.ok(ESCOPOS_SECRETA.includes(f.escopo), `${nome}: ${f.escopo} fora de ESCOPOS_SECRETA`);
    assert.ok(ESCOPOS_DO_MCP.includes(f.escopo), `${nome}: ${f.escopo} fora das áreas da tela`);
  }
  assert.ok(ESCOPOS[ESCOPO_DO_CONECTOR]);
});

test("o que altera a loja está marcado como alteração, e o nome não engana", () => {
  for (const nome of Object.keys(FERRAMENTAS)) {
    const altera = ferramentaAltera(nome);
    const pareceLeitura = /^(listar|obter|resumo)_/.test(nome);
    assert.equal(altera, !pareceLeitura, `${nome} está como ${altera ? "alteração" : "leitura"}`);
    assert.equal(anotacoes(nome).readOnlyHint, !altera);
  }
  // Ferramenta que o mapa não conhece não pode passar por leitura.
  assert.equal(ferramentaAltera("ferramenta_nova"), true);
  assert.equal(anotacoes("ferramenta_nova").readOnlyHint, false);
});

test("só consultar não deixa alterar nada", () => {
  const escopos = escoposDaAutorizacao({ nivel: "leitura" })!;
  for (const nome of Object.keys(FERRAMENTAS)) assert.equal(podeUsar(escopos, nome), !ferramentaAltera(nome), nome);
  assert.equal(resumoDoAcesso(escopos), "Só consulta");
});

test("acesso completo alcança todas as ferramentas", () => {
  const escopos = escoposDaAutorizacao({ nivel: "completo" })!;
  for (const nome of Object.keys(FERRAMENTAS)) assert.equal(podeUsar(escopos, nome), true, nome);
  assert.equal(resumoDoAcesso(escopos), "Consulta e altera tudo");
});

test("por área: quem altera também lê, e área sem o que alterar fica em leitura", () => {
  const escopos = escoposDaAutorizacao({ nivel: "areas", areas: { catalogo: "alterar", pedidos: "ler", clientes: "alterar", loja: "nenhum" } })!;
  assert.deepEqual(escopos, ["catalogo:ler", "catalogo:escrever", "pedidos:ler", "clientes:ler"]);
  assert.equal(podeUsar(escopos, "atualizar_produto"), true);
  assert.equal(podeUsar(escopos, "listar_pedidos"), true);
  assert.equal(podeUsar(escopos, "atualizar_status_pedido"), false);
  assert.equal(podeUsar(escopos, "criar_cupom"), false);
  assert.equal(podeUsar(escopos, "obter_loja"), false);
  assert.equal(resumoDoAcesso(escopos), "Catálogo (altera), Pedidos (consulta), Clientes (consulta)");
});

test("pedido de autorização sem escolha válida não vira conexão", () => {
  assert.equal(escoposDaAutorizacao({}), null);
  assert.equal(escoposDaAutorizacao({ nivel: "tudo" }), null);
  assert.equal(escoposDaAutorizacao({ nivel: "areas" }), null);
  assert.equal(escoposDaAutorizacao({ nivel: "areas", areas: { catalogo: "nenhum", inventada: "alterar" } }), null);
  // Escopo não se pede pelo nome: só pelas áreas da tela.
  assert.equal(escoposDaAutorizacao({ nivel: "areas", areas: { "mcp:usar": "alterar", "catalogo:escrever": "alterar" } }), null);
});

test("ferramenta desconhecida ou escopo de outra coisa não abre nada", () => {
  assert.equal(podeUsar([...ESCOPOS_DO_MCP], "apagar_loja"), false);
  assert.equal(podeUsar(["vitrine:ler", "mcp:usar"], "listar_produtos"), false);
});

test("toda área da tela tem ao menos uma ferramenta, de leitura e de alteração quando oferece", () => {
  const usados = new Set(Object.values(FERRAMENTAS).map((f) => f.escopo));
  for (const a of AREAS) {
    assert.ok(usados.has(a.ler), `${a.id}: ninguém usa ${a.ler}`);
    if (a.escrever) assert.ok(usados.has(a.escrever), `${a.id}: ninguém usa ${a.escrever}`);
  }
});

test("o histórico guarda identificador, nunca texto livre", () => {
  assert.equal(alvoDaChamada({ sku: "LIMPA5L", nome: "Limpador 5 litros" }), "LIMPA5L");
  assert.equal(alvoDaChamada({ id: "cmuz93dvm000072988qpgawpv" }), "cmuz93dvm000072988qpgawpv");
  assert.equal(alvoDaChamada({ numero: 1042 }), "1042");
  assert.equal(alvoDaChamada({ codigo: "KTS-21201/560" }), "KTS-21201/560");
  // Nome de cliente, e-mail e frase não são identificador, venham no campo que vierem.
  assert.equal(alvoDaChamada({ id: "Maria da Silva" }), null);
  assert.equal(alvoDaChamada({ id: "maria@exemplo.com" }), null);
  assert.equal(alvoDaChamada({ sku: "x".repeat(81) }), null);
  assert.equal(alvoDaChamada({ nome: "Maria", email: "maria@exemplo.com", descricao: "texto" }), null);
  assert.equal(alvoDaChamada({ id: { $ne: null } }), null);
});
