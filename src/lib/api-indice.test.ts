import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";
import { ehEscopo } from "./api-chaves";
import { ROTAS, indiceDaApi } from "./api-indice";

/**
 * O índice é a documentação pública. Rota que existe e não está nele não tem
 * documentação; rota que está nele e não existe é promessa.
 */

const arquivoDa = (caminho: string) => `src/app${caminho.replace(/\{(\w+)\}/g, "[$1]")}/route.ts`;

test("toda rota do índice existe, exporta o método e exige o escopo que o índice diz", () => {
  for (const r of ROTAS) {
    const arquivo = arquivoDa(r.caminho);
    assert.ok(existsSync(arquivo), `${r.metodo} ${r.caminho}: falta ${arquivo}`);
    const fonte = readFileSync(arquivo, "utf8");
    const exporta = fonte.match(new RegExp(`export const ${r.metodo} = rotaDaApi(?:<[^>]+>)?\\(\\{ escopo: "([^"]+)"`));
    assert.ok(exporta, `${r.metodo} ${r.caminho}: ${arquivo} não exporta ${r.metodo} por rotaDaApi`);
    assert.equal(exporta[1], r.escopo, `${r.metodo} ${r.caminho}: escopo no código é ${exporta[1]}`);
    assert.ok(ehEscopo(r.escopo));
  }
});

test("toda rota de /api/v1 que passa por rotaDaApi está no índice", () => {
  const noIndice = new Set(ROTAS.map((r) => `${r.metodo} ${arquivoDa(r.caminho)}`));
  const arquivos = [...new Set(ROTAS.map((r) => arquivoDa(r.caminho)))];
  for (const arquivo of arquivos) {
    for (const m of readFileSync(arquivo, "utf8").matchAll(/export const (GET|POST|PATCH|PUT|DELETE) = rotaDaApi/g)) {
      assert.ok(noIndice.has(`${m[1]} ${arquivo}`), `${m[1]} em ${arquivo} não está no índice`);
    }
  }
});

test("o índice explica os erros e não repete rota", () => {
  const i = indiceDaApi();
  assert.equal(i.erros.conflito, 409);
  assert.equal(new Set(ROTAS.map((r) => `${r.metodo} ${r.caminho}`)).size, ROTAS.length);
  for (const r of ROTAS) assert.ok(r.descricao.length > 20, r.caminho);
});
