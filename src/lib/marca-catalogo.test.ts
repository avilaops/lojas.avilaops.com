import assert from "node:assert/strict";
import test from "node:test";
import {
  conferirCatalogo,
  conferirMarca,
  marcaCitadaNoNome,
  normalizarParaMarca,
  vocabularioDeMarcas,
} from "./marca-catalogo";

/**
 * A marca declarada no catálogo vai inteira para o JSON-LD do produto e para o
 * `g:brand` do feed. O que se testa aqui é o limite da prova: o cadastro que se
 * contradiz tem de aparecer, e o que não se prova tem de ficar sem veredito em
 * vez de virar chute — marca inventada é o defeito, não a correção.
 *
 * Regressão de mudança compartilhada: vale para qualquer loja da plataforma.
 * O vocabulário sai do catálogo da própria loja, então nenhum nome de marca
 * está escrito na regra.
 */

const VOCABULARIO = ["Detailer", "Vintex", "Vonixx", "Wolf Pads"];

test("o vocabulário sai do catálogo e ignora vazio e repetição", () => {
  assert.deepEqual(
    vocabularioDeMarcas([
      { nome: "A", marca: "Vonixx" },
      { nome: "B", marca: "vonixx" },
      { nome: "C", marca: "  " },
      { nome: "D", marca: null },
      { nome: "E", marca: "Vintex" },
    ]),
    ["Vintex", "Vonixx"],
  );
});

test("normalizar tira acento, caixa e pontuação", () => {
  assert.equal(normalizarParaMarca("Ávila-Ops  S/A"), "avila ops s a");
});

test("o nome cita a marca mesmo com caixa e volume em volta", () => {
  assert.equal(marcaCitadaNoNome("MASSA DE POLIR VINTEX 500Ml", VOCABULARIO), "Vintex");
});

test("citação casa palavra inteira: 'Micro Wolf' não cita 'Wolf Pads'", () => {
  assert.equal(marcaCitadaNoNome("Boina Micro Wolf 133mm Ventilado", VOCABULARIO), null);
});

test("marca de duas palavras é citada quando aparece inteira", () => {
  assert.equal(marcaCitadaNoNome("Boina Wolf Pads 152mm", VOCABULARIO), "Wolf Pads");
});

test("nome que cita duas marcas independentes não prova nenhuma", () => {
  assert.equal(marcaCitadaNoNome("KIT VONIXX + VINTEX", VOCABULARIO), null);
});

test("entre marcas encaixadas vale a mais longa", () => {
  assert.equal(marcaCitadaNoNome("MASSA VINTEX PRO 1.8K", ["Vintex", "Vintex Pro"]), "Vintex Pro");
});

test("nome que cita a própria marca declarada confirma", () => {
  assert.deepEqual(conferirMarca({ nome: "REMOVEX VINTEX 1.5L", marca: "Vintex" }, VOCABULARIO), {
    situacao: "confirmada",
    marcaCitada: "Vintex",
  });
});

test("nome que cita outra marca do catálogo é divergência", () => {
  assert.deepEqual(conferirMarca({ nome: "ALUMAX 1.5L VINTEX", marca: "Vonixx" }, VOCABULARIO), {
    situacao: "divergente",
    marcaCitada: "Vintex",
  });
});

test("nome que não cita marca nenhuma fica sem evidência, não vira chute", () => {
  assert.deepEqual(conferirMarca({ nome: "DARKER 500ML", marca: "Vonixx" }, VOCABULARIO), {
    situacao: "sem-evidencia",
    marcaCitada: null,
  });
});

test("produto sem marca declarada não tem o que conferir", () => {
  assert.equal(conferirMarca({ nome: "DARKER 500ML", marca: null }, VOCABULARIO).situacao, "sem-marca");
  assert.equal(conferirMarca({ nome: "DARKER 500ML", marca: "  " }, VOCABULARIO).situacao, "sem-marca");
});

test("loja de marca única não tem com que se contradizer", () => {
  const r = conferirCatalogo([
    { nome: "Shampoo Acme 500ml", marca: "Acme" },
    { nome: "Cera 200g", marca: "Acme" },
  ]);
  assert.deepEqual(r.vocabulario, ["Acme"]);
  assert.equal(r.divergentes.length, 0);
  assert.equal(r.confirmadas.length, 1);
  assert.equal(r.semEvidencia.length, 1);
});

test("o catálogo separa os quatro veredictos e preserva os campos do produto", () => {
  const r = conferirCatalogo([
    { nome: "REMOVEX VINTEX 1.5L", marca: "Vintex", slug: "removex" },
    { nome: "ALUMAX 1.5L VINTEX", marca: "Vonixx", slug: "alumax" },
    { nome: "DARKER 500ML", marca: "Vonixx", slug: "darker" },
    { nome: "Boina Golden Wool", marca: null, slug: "boina" },
  ]);
  assert.deepEqual(r.confirmadas.map((l) => l.slug), ["removex"]);
  assert.deepEqual(r.divergentes.map((l) => l.slug), ["alumax"]);
  assert.deepEqual(r.semEvidencia.map((l) => l.slug), ["darker"]);
  assert.deepEqual(r.semMarca.map((l) => l.slug), ["boina"]);
});
