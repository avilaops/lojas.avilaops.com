import assert from "node:assert/strict";
import test from "node:test";
import { filtroDaUrl, porPaginaDaUrl, temFiltroAtivo } from "./filtros-url";
import { agruparMarcas, grafiasDaMarca } from "./catalogo";

test("categoria da rota vence a da URL", () => {
  // /categoria/anel-o-ring?categoria=retentor não pode listar retentores.
  const f = filtroDaUrl({ categoria: "retentor", di_de: "3,5", di_ate: "4", disponivel: "1", ordem: "menor-preco" }, "anel-o-ring");
  assert.equal(f.categoriaSlug, "anel-o-ring");
  assert.deepEqual(f.medidas, { diametroInternoMm: { de: 3.5, ate: 4 } });
  assert.equal(f.somenteDisponiveis, true);
  assert.equal(f.ordem, "menor-preco");
});

test("valores inválidos não viram filtro", () => {
  const f = filtroDaUrl({ di_de: "abc", ordem: "qualquer", min: "", disponivel: "sim" });
  assert.equal(f.medidas, undefined);
  assert.equal(f.ordem, "relevancia");
  assert.equal(f.minCentavos, undefined);
  assert.equal(f.somenteDisponiveis, false);
});

test("página e ordem padrão não contam como filtro ativo", () => {
  assert.equal(temFiltroAtivo({ pagina: "3", ordem: "relevancia" }), false);
  assert.equal(temFiltroAtivo({ alt_ate: "2" }), true);
  assert.equal(temFiltroAtivo({ disponivel: "1" }), true);
});

test("marcas: grafias do ERP viram uma entrada, com contagem somada", () => {
  const f = agruparMarcas(["SKF", "Skf", "Skf", "Ibira", "Ibirá", "IBIRÁ", "Ibirá", "DIVERSOS", null, " "]);
  assert.deepEqual(f.map((m) => [m.nome, m.itens]), [["Ibirá", 4], ["Skf", 3]]);
  assert.deepEqual(new Set(grafiasDaMarca(f, "ibira") as string[]), new Set(["Ibira", "Ibirá", "IBIRÁ"]));
  assert.equal(grafiasDaMarca(f, "Timken"), "Timken");
});

test("produtos por página: só os tamanhos oferecidos, senão 48", () => {
  for (const n of [24, 48, 96]) assert.equal(porPaginaDaUrl({ porPagina: String(n) }), n);
  for (const v of ["999999", "-1", "0", "Infinity", "24.5", "abc", undefined]) assert.equal(porPaginaDaUrl({ porPagina: v }), 48);
  assert.equal(temFiltroAtivo({ porPagina: "96" }), false);
});
