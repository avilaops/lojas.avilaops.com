import { test } from "node:test";
import assert from "node:assert/strict";
import { paragrafosDaDescricao } from "./descricao-produto";

test("mantém instruções e parágrafos sem renderizar HTML importado", () => {
  assert.deepEqual(paragrafosDaDescricao('<p>Aplicar na superfície fria.</p><h2>Modo de uso</h2><ul><li>Diluir 1:10.</li><li>Enxaguar &amp; secar.</li></ul><script>alert(1)</script>'),
    ["Aplicar na superfície fria.", "Modo de uso", "Diluir 1:10.", "Enxaguar & secar."]);
});
test("preserva texto simples e não inventa instruções", () => {
  assert.deepEqual(paragrafosDaDescricao("Não deixar secar.\r\n\r\nEnxaguar."), ["Não deixar secar.", "Enxaguar."]);
  assert.deepEqual(paragrafosDaDescricao(""), []);
});
test("separa marcadores achatados sem mudar o conteúdo ou a diluição", () => {
  const texto = "Benefícios ✔ Limpa ✔ Protege Modo de uso Diluir 1:10. Dica profissional: Não deixar secar.";
  const partes = paragrafosDaDescricao(texto);
  assert.equal(partes.join(" "), texto);
  assert.equal(partes.length, 5);
});
