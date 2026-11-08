import assert from "node:assert/strict";
import test from "node:test";
import { ENTRADAS_PK, gruposSegmentosPk } from "./jornada-pk";
import { listarEditorialPk, caminhosEditorialPk } from "./pk-editorial";

test("mapa cobre cada segmento publicado uma vez e mantém identidade e isolamento", () => {
  const grupos = gruposSegmentosPk("pkvedacoes");
  assert.equal(grupos.length, 5);
  const itens = grupos.flatMap(grupo => grupo.itens);
  assert.equal(itens.length, 10);
  assert.equal(new Set(itens.map(item => item.slug)).size, 10);
  assert.deepEqual(itens.map(item => item.slug).sort(), listarEditorialPk("pkvedacoes", "aplicacoes").map(item => item.slug).sort());
  assert.deepEqual(gruposSegmentosPk("vedashow"), []);
  assert.deepEqual(gruposSegmentosPk("domi-rio"), []);
});

test("as três entradas apontam para destinos reais distintos sem impor peça ou material", () => {
  assert.deepEqual(ENTRADAS_PK.map(item => item.id), ["codigo", "amostra", "aplicacao"]);
  assert.equal(new Set(ENTRADAS_PK.map(item => item.href)).size, 3);
  for (const entrada of ENTRADAS_PK) assert.ok(entrada.href === "/produtos" || caminhosEditorialPk("pkvedacoes").includes(entrada.href));
  assert.match(ENTRADAS_PK.find(item => item.id === "amostra")!.orientacao, /Desgaste e deformação/);
  assert.match(ENTRADAS_PK.find(item => item.id === "codigo")!.orientacao, /perfil e material/);
});
