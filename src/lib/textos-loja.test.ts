import assert from "node:assert/strict";
import test from "node:test";
import { descricaoDaLoja } from "./textos-loja";

/**
 * Medido na PK Vedações em 07/10/2026: sem slogan, a home saía no Google como
 * "Loja virtual PK Vedações", com o "Sobre" dizendo o que a loja vende.
 */
test("sem slogan, a descrição vem do diferencial ou do Sobre, não de 'Loja virtual'", () => {
  const sobre = "Gaxetas e raspadores para cilindros hidráulicos e pneumáticos — catálogo técnico completo.\n\nSegundo parágrafo.";
  assert.equal(descricaoDaLoja({ nome: "PK Vedações", slogan: null, sobre }, ""), "Gaxetas e raspadores para cilindros hidráulicos e pneumáticos — catálogo técnico completo.");
  assert.equal(descricaoDaLoja({ nome: "PK Vedações", slogan: null, sobre }, "Vedação sob medida."), "Vedação sob medida.");
});

test("slogan escrito vence tudo; em branco conta como ausente", () => {
  assert.equal(descricaoDaLoja({ nome: "Loja", slogan: "Pix na hora", sobre: "Texto" }, "Dif"), "Pix na hora");
  assert.equal(descricaoDaLoja({ nome: "Loja", slogan: "   ", sobre: "Texto do sobre" }, null), "Texto do sobre");
});

test("'Loja virtual' só quando não há nada escrito", () => {
  assert.equal(descricaoDaLoja({ nome: "Loja", slogan: null, sobre: null }), "Loja virtual Loja");
});

test("o Sobre é resumido ao tamanho do resultado de busca", () => {
  const longo = "palavra ".repeat(60).trim();
  const r = descricaoDaLoja({ nome: "Loja", slogan: null, sobre: longo });
  assert.ok(r.length <= 156 && r.endsWith("…"), r);
});
