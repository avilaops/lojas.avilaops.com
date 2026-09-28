import assert from "node:assert/strict";
import test from "node:test";
import { filtrosDaUrl, porPaginaDaUrl } from "./filtros-catalogo";

test("categoria da rota não escapa quando endereço fornece outra categoria", () => {
  const f = filtrosDaUrl({q: " 35x52x8,5 ", categoria: "rolamento", fabricante: "Sav", ordem: "menor-preco", di_de: "35", di_ate: "35", min: "7,00"}, "retentor");
  assert.equal(f.categoriaSlug, "retentor");
  assert.equal(f.busca, "35x52x8,5");
  assert.equal(f.fabricante, "Sav");
  assert.equal(f.minCentavos, 700);
  assert.deepEqual(f.medidas, {diametroInternoMm:{de:35,ate:35}});
});
test("seção aceita vírgula e tamanho de página tem limites seguros", () => {
  assert.deepEqual(filtrosDaUrl({sec_de:"1,78",sec_ate:"1.78"}).medidas, {secaoMm:{de:1.78,ate:1.78}});
  for(const n of [24,48,96]) assert.equal(porPaginaDaUrl({porPagina:String(n)}), n);
  for(const v of ["999999","-1","0","Infinity","24.5","abc",undefined]) assert.equal(porPaginaDaUrl({porPagina:v}),48);
  assert.equal(filtrosDaUrl({ordem:"sql"}).ordem,"relevancia");
});
