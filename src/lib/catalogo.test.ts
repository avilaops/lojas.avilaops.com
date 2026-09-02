import assert from "node:assert/strict";
import test from "node:test";
import { termosDeBusca } from "./catalogo";

/**
 * Em catálogo técnico a pessoa digita a peça como ela é falada na oficina.
 * O mesmo rolamento é procurado como "6204", "6204 2rs", "6204-2rs" e
 * "20x47x14" — e a medida colada era o caso que devolvia "nenhum produto"
 * com o item em estoque e a medida cadastrada.
 */

test("palavra solta continua como estava", () => {
  assert.deepEqual(termosDeBusca("valvula pressao"), ["valvula", "pressao"]);
});

test("acento sai, para quem digita sem no celular", () => {
  assert.deepEqual(termosDeBusca("válvula"), ["valvula"]);
});

test("medida colada com x vira três termos", () => {
  assert.deepEqual(termosDeBusca("20x47x14"), ["20", "47", "14"]);
});

test("medida com × e espaço também", () => {
  assert.deepEqual(termosDeBusca("20 × 47 × 14"), ["20", "47", "14"]);
});

test("medida com hífen entre números separa", () => {
  assert.deepEqual(termosDeBusca("20-47-14"), ["20", "47", "14"]);
});

test("código com hífen acha o mesmo que com espaço", () => {
  // Medido no catálogo da Vedashow: "6205 2RS" achava 6 produtos e
  // "6205-2rs" achava 2, porque o termo com hífen só casava com quem tinha o
  // hífen escrito igual no cadastro. Quem digita das duas formas procura a
  // mesma peça, então o hífen separa e os dois termos casam por AND.
  assert.deepEqual(termosDeBusca("6204-2rs"), ["6204", "2rs"]);
});

test("prefixo de balcão colado no código separa", () => {
  // "ROL6205" e "RET.30X47X7" são como o código sai do sistema do lojista, e
  // o comprador digita igual.
  assert.deepEqual(termosDeBusca("rol6205"), ["rol", "6205"]);
  assert.deepEqual(termosDeBusca("ret.30x47x7"), ["ret", "30", "47", "7"]);
});

test("código de série separa letra e número", () => {
  // "uc209" vira "uc 209", pela mesma regra do prefixo de balcão. Os dois
  // termos casam por AND, então continua achando o UC209 — e passa a achar
  // também quem cadastrou como "UC 209", que é comum no mesmo catálogo.
  assert.deepEqual(termosDeBusca("uc209"), ["uc", "209"]);
});

test("medida junto do tipo mantém os dois", () => {
  assert.deepEqual(termosDeBusca("retentor 35x52x8"), ["retentor", "35", "52", "8"]);
});

test("termo de uma letra é descartado", () => {
  // Uma letra casa com quase tudo e só atrapalha o resultado.
  assert.deepEqual(termosDeBusca("rolamento a 6204"), ["rolamento", "6204"]);
});

test("no máximo seis termos", () => {
  assert.equal(termosDeBusca("um dois tres quatro cinco seis sete oito").length, 6);
});
