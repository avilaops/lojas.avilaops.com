import assert from "node:assert/strict";
import test from "node:test";
import { centavosDaUrl, faixasDaUrl, filtroDaUrl, milimetroDaUrl, ordemDaUrl } from "./filtros-url";

/**
 * A URL da listagem é entrada de estranho: chega de link colado, de robô e de
 * quem edita a barra de endereço. Nenhum valor daqui pode derrubar a página
 * nem virar filtro que exclui o catálogo inteiro sem querer.
 */

test("dinheiro vira centavos inteiros, aceitando como o brasileiro escreve", () => {
  // O ponto de milhar era lido como decimal: `1.234,50` filtrava por R$ 1,23
  // e devolvia o catálogo quase inteiro, sem nada explicando na tela.
  assert.equal(centavosDaUrl("1.234,50"), 123450);
  assert.equal(centavosDaUrl("R$ 1.234"), 123400);
  assert.equal(centavosDaUrl("R$ 20"), 2000);
  // Sem vírgula e sem grupo de três, o ponto continua sendo decimal.
  assert.equal(centavosDaUrl("20.5"), 2050);
  assert.equal(centavosDaUrl("12.34"), 1234);
  assert.equal(centavosDaUrl("1.234.567"), 123456700);
  assert.equal(centavosDaUrl(undefined), undefined);
  assert.equal(centavosDaUrl(""), undefined);
  assert.equal(centavosDaUrl("abc"), undefined);
});

test("milímetro aceita vírgula e recusa negativo", () => {
  assert.equal(milimetroDaUrl("20,5"), 20.5);
  assert.equal(milimetroDaUrl("20.5"), 20.5);
  assert.equal(milimetroDaUrl("-3"), undefined);
  assert.equal(milimetroDaUrl("nada"), undefined);
});

test("ordem desconhecida não quebra a página", () => {
  assert.equal(ordemDaUrl({ ordem: "menor-preco" }), "menor-preco");
  assert.equal(ordemDaUrl({ ordem: "drop table" }), "relevancia");
  assert.equal(ordemDaUrl({}), "relevancia");
});

test("faixa com um extremo só vale; sem nenhum, não existe", () => {
  assert.deepEqual(faixasDaUrl({ di_de: "20" }), { diametroInternoMm: { de: 20, ate: undefined } });
  assert.deepEqual(faixasDaUrl({ alt_ate: "14" }), { alturaMm: { de: undefined, ate: 14 } });
  // Faixa vazia não pode virar `{}`: o filtro exclui quem não tem a medida
  // cadastrada, e um `{}` acidental esvaziaria a categoria inteira.
  assert.equal(faixasDaUrl({ di_de: "", di_ate: "" }), undefined);
  assert.equal(faixasDaUrl({}), undefined);
});

test("as três medidas convivem numa consulta só", () => {
  assert.deepEqual(faixasDaUrl({ di_de: "20", di_ate: "25", de_de: "40", alt_ate: "10" }), {
    diametroInternoMm: { de: 20, ate: 25 },
    diametroExternoMm: { de: 40, ate: undefined },
    alturaMm: { de: undefined, ate: 10 },
  });
});

test("o filtro inteiro sai da URL, com espaço em branco fora", () => {
  assert.deepEqual(filtroDaUrl({ q: "  6205  ", fabricante: " FAG ", min: "10", max: "", ordem: "nome", di_de: "25" }), {
    busca: "6205",
    fabricante: "FAG",
    ordem: "nome",
    minCentavos: 1000,
    maxCentavos: undefined,
    medidas: { diametroInternoMm: { de: 25, ate: undefined } },
  });
});

test("URL sem filtro nenhum não inventa filtro", () => {
  // Campo em branco no formulário chega como "": não pode virar busca por "",
  // que no Prisma casaria com tudo e trocaria a ordem da listagem.
  assert.deepEqual(filtroDaUrl({ q: "", fabricante: "", pagina: "3" }), {
    busca: undefined,
    fabricante: undefined,
    ordem: "relevancia",
    minCentavos: undefined,
    maxCentavos: undefined,
    medidas: undefined,
  });
});
