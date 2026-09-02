import { strict as assert } from "node:assert";
import { test } from "node:test";
import { enriquecerNome, temMedida } from "./nome-produto";

/**
 * O enriquecedor existe para consertar a previsão de categoria do Mercado
 * Livre, e os casos abaixo são os reais do catálogo da Vedashow.
 */

test("abreviação de balcão vira palavra: RET. é retentor", () => {
  const r = enriquecerNome({ nome: "RET.49X65X10 BAG T.B", grupo: "RETENTOR" });
  assert.match(r.nome, /^Retentor/);
  assert.equal(r.mudou, true);
});

test("ruído de embalagem sai do nome", () => {
  const r = enriquecerNome({ nome: "RET.49X65X10 BAG T.B", grupo: "RETENTOR" });
  assert.doesNotMatch(r.nome, /BAG|T\.B/i);
});

test("a medida sobrevive: é o que identifica a peça", () => {
  const r = enriquecerNome({ nome: "RET.49X65X10 BAG T.B", grupo: "RETENTOR" });
  assert.match(r.nome, /49X65X10/i);
  assert.equal(temMedida(r.nome), true);
});

test("o qualificador do grupo entra, porque é ele que corrige a categoria", () => {
  // "Rolamento 6205" cai em Águas Minerais no preditor do ML; com "rígido de
  // esferas" ele acerta. Ver o comentário em src/lib/mercadolivre.ts.
  const r = enriquecerNome({ nome: "ROL.6205 2RS", grupo: "ROLAMENTO" });
  assert.match(r.nome, /Rolamento rígido de esferas/);
  assert.match(r.nome, /6205/);
});

test("sigla técnica curta continua em caixa alta", () => {
  const r = enriquecerNome({ nome: "ROL.6205 2RS", grupo: "ROLAMENTO" });
  assert.match(r.nome, /2RS/);
});

test("marca entra no fim quando existe", () => {
  const r = enriquecerNome({ nome: "ROL.6205 2RS", grupo: "ROLAMENTO", marca: "FAG" });
  assert.match(r.nome, /FAG$/);
});

test('marca "DIVERSOS" não entra: não é marca, é ausência dela', () => {
  const r = enriquecerNome({ nome: "RET.30X47X7", grupo: "RETENTOR", marca: "DIVERSOS" });
  assert.doesNotMatch(r.nome, /DIVERSOS/i);
});

test("marca já presente no nome não é repetida", () => {
  const r = enriquecerNome({ nome: "ROL.6205 2RS FAG", grupo: "ROLAMENTO", marca: "FAG" });
  assert.equal(r.nome.match(/FAG/g)?.length, 1);
});

test("grupo vira palavra principal quando não há abreviação", () => {
  const r = enriquecerNome({ nome: "5PK 1230", grupo: "CORREIA" });
  assert.match(r.nome, /^Correia/);
});

test("grupo não é repetido quando o nome já o contém", () => {
  const r = enriquecerNome({ nome: "CORREIA 5PK 1230", grupo: "CORREIA" });
  assert.equal(r.nome.toLowerCase().match(/correia/g)?.length, 1);
});

test('grupo "DIVERSOS" não vira palavra principal', () => {
  const r = enriquecerNome({ nome: "Papelão Velumoid 0,40", grupo: "DIVERSOS" });
  assert.doesNotMatch(r.nome, /^Diversos/i);
});

test("nome que já está bom não é mexido à toa", () => {
  const r = enriquecerNome({ nome: "Eletrodo FX 13 3,25 mm", grupo: "" });
  assert.equal(r.mudou, false);
});

test("é determinístico: a mesma entrada dá a mesma saída", () => {
  const entrada = { nome: "RET.52,40X80,95X11,50 00005 B T.B", grupo: "RETENTOR", marca: "SAV" };
  assert.equal(enriquecerNome(entrada).nome, enriquecerNome(entrada).nome);
});

test("informa o que aplicou, para o lojista poder conferir", () => {
  const r = enriquecerNome({ nome: "RET.49X65X10 BAG T.B", grupo: "RETENTOR", marca: "SAV" });
  assert.ok(r.aplicou.length >= 3);
  assert.ok(r.aplicou.some((a) => a.includes("abreviação")));
});

test("nome sem medida é reconhecido como tal", () => {
  assert.equal(temMedida("Papelão Velumoid amarelo"), false);
});

test("qualificador do retentor é o que o preditor reconhece", () => {
  // "de vedação" não movia o preditor do ML; "para veículos" move. Ver o
  // comentário do QUALIFICADOR em nome-produto.ts.
  const r = enriquecerNome({ nome: "RET.49X65X10 BAG T.B", grupo: "RETENTOR" });
  assert.match(r.nome, /Retentor para veículos 49X65X10/);
});

test("não afirma aplicação que o dado não comprova", () => {
  // "de roda" funcionaria igual no preditor, e seria mentira para retentor
  // industrial. O termo escolhido é amplo de propósito.
  const r = enriquecerNome({ nome: "RET.30X47X7", grupo: "RETENTOR" });
  assert.doesNotMatch(r.nome, /roda|automotivo|Fiat|motor/i);
});
