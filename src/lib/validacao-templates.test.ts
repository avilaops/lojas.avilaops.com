import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { VALORES_LAYOUT } from "./tema";
import { LIMITE_RASCUNHO, lerRascunho } from "./previa-tema";
import { VIEWPORTS, avaliarMedida, casosDeValidacao, type CasoDeValidacao, type MedidaDoCaso } from "./validacao-templates";

const temaPremium = JSON.parse(readFileSync(new URL("../../tests/fixtures/tema-premium-completo.json", import.meta.url), "utf8")) as Record<string, unknown>;
const casos = casosDeValidacao(temaPremium);

const tDe = (caso: CasoDeValidacao) => new URL(caso.caminho, "http://localhost").searchParams.get("t") ?? "";

function casoDe(id: string): CasoDeValidacao {
  const caso = casos.find((c) => c.id === id);
  assert.ok(caso, `caso ${id} não existe`);
  return caso;
}

/** Medida de um caso que passou em tudo. */
function limpa(caso: CasoDeValidacao, mudancas: Partial<MedidaDoCaso> = {}): MedidaDoCaso {
  return {
    layoutDesenhado: caso.layout,
    modoNoHtml: caso.modo,
    vazaLateralPx: 0,
    culpado: null,
    errosDePagina: [],
    corTexto: caso.modo === "escuro" ? "#fafafa" : "#18181b",
    corFundo: caso.modo === "escuro" ? "#0b0b0c" : "#ffffff",
    animacoesAtivas: 0,
    transicoesComDuracao: 0,
    ...mudancas,
  };
}

test("viewports são o celular de referência e o desktop comum", () => {
  assert.deepEqual(VIEWPORTS.movel, { width: 390, height: 844 });
  assert.deepEqual(VIEWPORTS.desktop, { width: 1280, height: 800 });
});

test("a matriz tem 96 casos de id único, 8 por layout", () => {
  assert.equal(casos.length, 96);
  assert.equal(new Set(casos.map((c) => c.id)).size, 96);
  for (const layout of VALORES_LAYOUT) {
    assert.equal(casos.filter((c) => c.layout === layout).length, 8, layout);
  }
  for (const caso of casos) {
    assert.equal(caso.id, `${caso.layout}.${caso.viewport}.${caso.modo}.${caso.movimento}`);
  }
});

test("o rascunho de cada caso volta com o layout e o modo do caso e cabe no limite", () => {
  for (const caso of casos) {
    assert.ok(caso.caminho.startsWith("/painel/previa?t="), caso.id);
    const t = tDe(caso);
    assert.ok(t.length > 0 && t.length <= LIMITE_RASCUNHO, `${caso.id}: ${t.length} caracteres`);
    const tema = lerRascunho(t);
    assert.ok(tema, `${caso.id}: rascunho não validou`);
    assert.equal(tema.layout, caso.layout);
    assert.equal(tema.modo, caso.modo);
  }
});

test("o Automotivo Premium parte do tema preenchido e troca só o modo", () => {
  const tema = lerRascunho(tDe(casoDe("automotivo-premium.movel.escuro.normal")));
  assert.ok(tema);
  assert.deepEqual({ ...tema, modo: "claro" }, { ...temaPremium, modo: "claro" });
  assert.equal(tema.modo, "escuro");
});

test("sem o tema premium a matriz continua inteira", () => {
  assert.equal(casosDeValidacao().length, 96);
});

test("medida limpa passa nos 96 casos", () => {
  for (const caso of casos) assert.deepEqual(avaliarMedida(caso, limpa(caso)), [], caso.id);
});

test("regra a: prévia que não desenhou o layout falha", () => {
  const caso = casoDe("classico.movel.claro.normal");
  const ausente = avaliarMedida(caso, limpa(caso, { layoutDesenhado: null }));
  assert.equal(ausente.length, 1);
  assert.match(ausente[0], /não desenhou/);
  const outro = avaliarMedida(caso, limpa(caso, { layoutDesenhado: "minimal" }));
  assert.equal(outro.length, 1);
  assert.match(outro[0], /minimal/);
});

test("regra b: modo diferente no <html> falha", () => {
  const caso = casoDe("vitrine.desktop.escuro.normal");
  const falhas = avaliarMedida(caso, limpa(caso, { modoNoHtml: "claro" }));
  assert.equal(falhas.length, 1);
  assert.match(falhas[0], /modo/);
});

test("regra c: vazamento lateral falha e nomeia o culpado", () => {
  const caso = casoDe("mercado.movel.claro.normal");
  const falhas = avaliarMedida(caso, limpa(caso, { vazaLateralPx: 24, culpado: "DIV mercado-grade-categorias" }));
  assert.equal(falhas.length, 1);
  assert.match(falhas[0], /24px/);
  assert.match(falhas[0], /mercado-grade-categorias/);
});

test("regra d: erro de página falha", () => {
  const caso = casoDe("editorial.desktop.claro.normal");
  const falhas = avaliarMedida(caso, limpa(caso, { errosDePagina: ["TypeError: x is undefined"] }));
  assert.equal(falhas.length, 1);
  assert.match(falhas[0], /TypeError/);
});

test("regra e: contraste abaixo de 4.5 falha, e cor ilegível também", () => {
  const caso = casoDe("minimal.movel.claro.normal");
  const baixo = avaliarMedida(caso, limpa(caso, { corTexto: "#9ca3af", corFundo: "#ffffff" }));
  assert.equal(baixo.length, 1);
  assert.match(baixo[0], /contraste/);
  const ilegivel = avaliarMedida(caso, limpa(caso, { corTexto: "", corFundo: "#ffffff" }));
  assert.equal(ilegivel.length, 1);
  assert.match(ilegivel[0], /contraste/);
});

test("regra e: a fronteira do contraste é 4.5 (4,54 passa, 4,48 falha)", () => {
  const caso = casoDe("minimal.movel.claro.normal");
  assert.deepEqual(avaliarMedida(caso, limpa(caso, { corTexto: "#767676", corFundo: "#ffffff" })), []);
  const abaixo = avaliarMedida(caso, limpa(caso, { corTexto: "#777777", corFundo: "#ffffff" }));
  assert.equal(abaixo.length, 1);
  assert.match(abaixo[0], /4\.48/);
});

test("regra f: animação ou transição falha só com movimento reduzido", () => {
  const reduzido = casoDe("spotlight.desktop.claro.reduzido");
  const animacao = avaliarMedida(reduzido, limpa(reduzido, { animacoesAtivas: 2 }));
  assert.equal(animacao.length, 1);
  assert.match(animacao[0], /animação/);
  const transicao = avaliarMedida(reduzido, limpa(reduzido, { transicoesComDuracao: 31 }));
  assert.equal(transicao.length, 1);
  assert.match(transicao[0], /transição/);

  const normal = casoDe("spotlight.desktop.claro.normal");
  assert.deepEqual(avaliarMedida(normal, limpa(normal, { animacoesAtivas: 2, transicoesComDuracao: 31 })), []);
});
