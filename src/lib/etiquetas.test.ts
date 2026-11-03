import { test } from "node:test";
import assert from "node:assert/strict";
import { codigoInterno, lerCodigoInterno, ConsultaEtiquetas, quantidadeValida } from "./etiquetas";
import { gerarBarras } from "./etiquetas-barras";

test("código interno distingue variantes e mantém o ID completo", () => {
  const id = "cm12345678901234567890123";
  assert.equal(id.length, 25);
  const codigo = codigoInterno(id);
  assert.equal(lerCodigoInterno(codigo), id);
  assert.notEqual(codigo, codigoInterno("cm12345678901234567890124"));
  assert.equal(lerCodigoInterno("7898511024485"), null);
  assert.equal(lerCodigoInterno(`${codigo}\n`), null);
  assert.throws(() => codigoInterno("<script>"));
  for (const antigo of ["vp_00000000000000000000000000000001", "vp_ffffffffffffffffffffffffffffffff"]) {
    assert.equal(lerCodigoInterno(codigoInterno(antigo)), antigo);
    assert.match(gerarBarras(codigoInterno(antigo), "interno"), /<svg/);
  }
  assert.equal(lerCodigoInterno(`V:M${"9".repeat(39)}`), null);
  assert.equal(lerCodigoInterno("V:M001"), null);
});

test("geração preserva zeros do GTIN e rejeita checksum inválido", () => {
  for (const codigo of ["96385074", "036000291452", "7898511024485", "10012345000017"]) {
    const svg = gerarBarras(codigo, "gtin");
    assert.match(svg, /<svg/);
    assert.match(svg, /viewBox=/);
    assert.doesNotMatch(svg, /<script|<image|<foreignObject/);
  }
  for (const codigo of ["7898511024486", "00000000", "123", "<svg>", "036000291452 "]) {
    assert.throws(() => gerarBarras(codigo, "gtin"), /GTIN/);
  }
});

test("parâmetros e quantidades limitam processamento e impressão", () => {
  assert.equal(ConsultaEtiquetas.parse({}).tipo, "interno");
  for (const dados of [{ pagina: 0 }, { pagina: 1.5 }, { pagina: 100001 }, { tipo: "ean" }, { q: "x".repeat(101) }]) {
    assert.equal(ConsultaEtiquetas.safeParse(dados).success, false);
  }
  for (const n of [0, -1, 1.5, NaN, Infinity, 201]) assert.equal(quantidadeValida(n), false);
  assert.equal(quantidadeValida(1), true);
  assert.equal(quantidadeValida(200), true);
});
