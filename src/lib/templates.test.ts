import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { VALORES_LAYOUT } from "./tema";
import { BLOCOS, CONTRATOS, VERSAO_CONTRATO, contratoDo, usaBlocoProprio } from "./templates";

/**
 * O contrato é a única resposta para "qual template troca qual bloco". Estes
 * testes prendem as duas pontas: o schema (todo layout tem contrato) e o CSS
 * (todo token declarado existe, e todo token do CSS está declarado).
 */

const contratos = Object.values(CONTRATOS);

test("todo layout tem contrato, e não há contrato sobrando", () => {
  assert.deepEqual(Object.keys(CONTRATOS).sort(), [...VALORES_LAYOUT].sort());
  for (const [chave, c] of Object.entries(CONTRATOS)) assert.equal(c.layout, chave);
});

test("todo contrato declara os seis blocos na versão em vigor", () => {
  for (const c of contratos) {
    assert.deepEqual(Object.keys(c.blocos).sort(), [...BLOCOS].sort(), c.layout);
    for (const bloco of BLOCOS) assert.ok(["compartilhado", "proprio"].includes(c.blocos[bloco]), `${c.layout}.${bloco}`);
    assert.equal(c.versao, VERSAO_CONTRATO, c.layout);
  }
});

test("só o premium veste a loja inteira; os outros compõem a home", () => {
  const premium = CONTRATOS["automotivo-premium"];
  assert.equal(premium.escopo, "loja");
  assert.deepEqual(premium.blocos, { cabecalho: "proprio", hero: "proprio", categorias: "proprio", produto: "proprio", carrinho: "proprio", rodape: "compartilhado" });
  for (const c of contratos.filter((c) => c.layout !== "automotivo-premium")) {
    assert.equal(c.escopo, "home", c.layout);
    assert.deepEqual(BLOCOS.filter((b) => c.blocos[b] === "proprio"), ["hero"], c.layout);
    assert.deepEqual(c.tokens, [], c.layout);
    assert.equal(c.atributoHtml, false, c.layout);
  }
});

test("as páginas perguntam ao contrato e recebem a resposta do layout", () => {
  assert.equal(usaBlocoProprio({ layout: "automotivo-premium" }, "carrinho"), true);
  assert.equal(usaBlocoProprio({ layout: "automotivo-premium" }, "rodape"), false);
  assert.equal(usaBlocoProprio({ layout: "classico" }, "cabecalho"), false);
  assert.equal(contratoDo({ layout: "vitrine" }), CONTRATOS.vitrine);
});

test("os tokens do contrato são exatamente os que o CSS do template define", () => {
  for (const c of contratos.filter((c) => c.atributoHtml)) {
    const css = readFileSync(`src/components/templates/${c.layout}/premium.css`, "utf8");
    const seletor = new RegExp(`html\\[data-template="${c.layout}"\\][^{]*\\{([^}]*)\\}`, "g");
    const noCss = new Set<string>();
    for (const regra of css.matchAll(seletor)) {
      for (const prop of regra[1].matchAll(/(--[a-z0-9-]+)\s*:/g)) noCss.add(prop[1]);
    }
    assert.ok(noCss.size > 0, `${c.layout}: nenhum token encontrado no CSS`);
    assert.equal(new Set(c.tokens).size, c.tokens.length, `${c.layout}: token repetido`);
    assert.deepEqual([...c.tokens].sort(), [...noCss].sort(), c.layout);
  }
});

test("quem marca o <html> troca mais do que o hero", () => {
  for (const c of contratos.filter((c) => c.atributoHtml)) {
    assert.ok(BLOCOS.some((b) => b !== "hero" && c.blocos[b] === "proprio"), c.layout);
  }
});

test("nenhuma página compara o layout com o nome do template", () => {
  const arquivos = (readdirSync("src/app", { recursive: true }) as string[])
    .filter((f) => /\.(ts|tsx)$/.test(f))
    .map((f) => join("src/app", f));
  assert.ok(arquivos.length > 20, "a varredura de src/app não achou as páginas");
  for (const arquivo of arquivos) {
    assert.equal(readFileSync(arquivo, "utf8").includes('=== "automotivo-premium"'), false, arquivo);
  }
});
