import assert from "node:assert/strict";
import test from "node:test";
import { faixasDaUrl, filtroDaUrl, porPaginaDaUrl, reaisDaUrl, temFiltroAtivo } from "./filtros-url";
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

test("dinheiro vira centavos inteiros, aceitando como o brasileiro escreve", () => {
  // O ponto de milhar era lido como decimal: `1.234,50` filtrava por R$ 1,23.
  assert.equal(reaisDaUrl("1.234,50"), 123450);
  assert.equal(reaisDaUrl("R$ 1.234"), 123400);
  assert.equal(reaisDaUrl("R$ 20"), 2000);
  assert.equal(reaisDaUrl("20.5"), 2050);
  assert.equal(reaisDaUrl("12.34"), 1234);
  assert.equal(reaisDaUrl("1.234.567"), 123456700);
  assert.equal(reaisDaUrl(""), undefined);
  assert.equal(reaisDaUrl("abc"), undefined);
});

test("medida tem que ser número: lixo na URL não filtra", () => {
  assert.equal(faixasDaUrl({ di_de: "20abc" }), undefined);
  assert.equal(faixasDaUrl({ di_de: "-5" }), undefined);
  assert.equal(faixasDaUrl({ di_de: "", di_ate: "" }), undefined);
  assert.deepEqual(faixasDaUrl({ di_de: " 20,5 " }), { diametroInternoMm: { de: 20.5, ate: undefined } });
});
