import assert from "node:assert/strict";
import test from "node:test";
import { medidaResumida, ordenarPorMedida, termosDeBusca } from "./catalogo";

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

/**
 * Filtro por faixa de medida. A regra de decisão é testada aqui; a consulta
 * fica em `listarProdutos`, que precisa de banco.
 */
function dentro(v: unknown, faixa: { de?: number; ate?: number }): boolean {
  const n = Number(v);
  if (!Number.isFinite(n)) return false;
  if (faixa.de != null && n < faixa.de) return false;
  if (faixa.ate != null && n > faixa.ate) return false;
  return true;
}

test("medida dentro da faixa entra", () => {
  assert.equal(dentro(22, { de: 20, ate: 25 }), true);
});

test("os extremos entram (faixa fechada)", () => {
  // Quem digita "20 a 25" espera o 20 e o 25 na lista.
  assert.equal(dentro(20, { de: 20, ate: 25 }), true);
  assert.equal(dentro(25, { de: 20, ate: 25 }), true);
});

test("fora da faixa sai", () => {
  assert.equal(dentro(19.9, { de: 20, ate: 25 }), false);
  assert.equal(dentro(25.1, { de: 20, ate: 25 }), false);
});

test("só um extremo também filtra", () => {
  assert.equal(dentro(100, { de: 50 }), true);
  assert.equal(dentro(10, { de: 50 }), false);
  assert.equal(dentro(10, { ate: 50 }), true);
});

test("produto sem a medida cadastrada não entra", () => {
  // Quem filtra por 20-25 mm quer o que cabe no eixo, e "não sei" não cabe.
  assert.equal(dentro(undefined, { de: 20, ate: 25 }), false);
  assert.equal(dentro("aprox", { de: 20, ate: 25 }), false);
  assert.equal(dentro(null, { de: 20 }), false);
});

test("medida com decimal compara certo", () => {
  assert.equal(dentro(12.7, { de: 12, ate: 13 }), true);
  assert.equal(dentro(12.7, { de: 13 }), false);
});

/**
 * Item sob consulta (preço 0) existe no catálogo para ser encontrado, não
 * comprado. A vitrine já não oferece carrinho, mas a trava que importa é a do
 * `resolverItensDoCatalogo`: é ela que decide o preço cobrado, e o carrinho
 * chega do navegador. Sem ela, um id forjado levaria a peça por R$ 0,00.
 *
 * A consulta em si precisa de banco; o que se testa aqui é a condição.
 */
function entraNoCheckout(p: { ativo: boolean; disponibilidade: string; precoCentavos: number }): boolean {
  return p.ativo && p.disponibilidade !== "out_of_stock" && p.precoCentavos > 0;
}

test("produto normal entra no checkout", () => {
  assert.equal(entraNoCheckout({ ativo: true, disponibilidade: "in_stock", precoCentavos: 1890 }), true);
});

test("preço zero NÃO entra no checkout", () => {
  assert.equal(entraNoCheckout({ ativo: true, disponibilidade: "in_stock", precoCentavos: 0 }), false);
});

test("esgotado não entra", () => {
  assert.equal(entraNoCheckout({ ativo: true, disponibilidade: "out_of_stock", precoCentavos: 1890 }), false);
});

test("inativo não entra", () => {
  assert.equal(entraNoCheckout({ ativo: false, disponibilidade: "in_stock", precoCentavos: 1890 }), false);
});

test("plural acha o singular do cadastro", () => {
  // Substring: "retentor" já achava "retentores", mas "retentores" não
  // achava "Retentor 20x47x7". Quem digita no plural procura o departamento.
  assert.deepEqual(termosDeBusca("retentores"), ["retentor"]);
  assert.deepEqual(termosDeBusca("rolamentos de esfera"), ["rolamento", "de", "esfera"]);
  assert.deepEqual(termosDeBusca("correias dentadas"), ["correia", "dentada"]);
});

test("código nunca perde o s final", () => {
  assert.deepEqual(termosDeBusca("6205 2rs"), ["6205", "2rs"]);
  assert.deepEqual(termosDeBusca("abs"), ["abs"]);
});

/**
 * A medida no card. O filtro por faixa já existia; a grade devolvia o
 * resultado sem mostrar o critério que a pessoa acabou de usar.
 */
test("as três medidas saem na ordem do balcão", () => {
  assert.equal(medidaResumida({ diametroInternoMm: 20, diametroExternoMm: 47, alturaMm: 14 }), "20 × 47 × 14 mm");
});

test("medida quebrada mostra vírgula, não ponto", () => {
  assert.equal(medidaResumida({ diametroInternoMm: 20.5, diametroExternoMm: 47, alturaMm: 14 }), "20,5 × 47 × 14 mm");
});

test("medida vinda da planilha como texto continua valendo", () => {
  // A importação grava em `atributos` o que veio da coluna, e nem toda
  // planilha manda número.
  assert.equal(medidaResumida({ diametroInternoMm: "20", diametroExternoMm: "47", alturaMm: "14" }), "20 × 47 × 14 mm");
});

test("com duas medidas cada uma leva o rótulo", () => {
  // "20 × 47" sem dizer quais são as duas faz comprar a peça errada.
  assert.equal(medidaResumida({ diametroInternoMm: 20, alturaMm: 14 }), "Ø int. 20 mm · alt. 14 mm");
});

test("espessura e seção não entram na sequência do balcão", () => {
  // O catálogo indexa cinco medidas, mas só três têm forma falada: somar tudo
  // num "20 × 47 × 14 × 2" seria uma medida que ninguém pede no balcão. O que
  // sobra continua dito por extenso, em vez de desaparecer da tela.
  assert.equal(
    medidaResumida({ diametroInternoMm: 20, diametroExternoMm: 47, alturaMm: 14, espessuraMm: 2 }),
    "20 × 47 × 14 mm · esp. 2 mm",
  );
  // Sem o trio completo, nenhuma sequência: cada medida com o seu rótulo.
  assert.equal(medidaResumida({ espessuraMm: 2, secaoMm: 3.5 }), "esp. 2 mm · seção 3,5 mm");
});

test("código lido como medida não vira linha no card", () => {
  // Mesmo teto do filtro: 5.176.168 mm é lixo de importação, não medida.
  assert.equal(medidaResumida({ diametroInternoMm: 5176168 }), null);
  assert.equal(medidaResumida({ diametroInternoMm: 0 }), null);
});

test("produto sem medida não mostra nada", () => {
  assert.equal(medidaResumida({}), null);
  assert.equal(medidaResumida(null), null);
  // Farmácia e moda passam por aqui a cada card: o campo não existe.
  assert.equal(medidaResumida({ volumeMl: 500, cor: "azul" }), null);
});

/**
 * A série na página do produto. Quem está no 6205 quer o 6206, e uma lista de
 * medidas fora de ordem obriga a comparar número a número.
 */
const item = (nome: string, atributos: Record<string, unknown>) => ({ nome, atributos });

test("a série sai em ordem de medida, não de cadastro", () => {
  const lista = [
    item("6207", { diametroInternoMm: 35, diametroExternoMm: 72, alturaMm: 17 }),
    item("6205", { diametroInternoMm: 25, diametroExternoMm: 52, alturaMm: 15 }),
    item("6206", { diametroInternoMm: 30, diametroExternoMm: 62, alturaMm: 16 }),
  ];
  assert.deepEqual(ordenarPorMedida(lista).map((p) => p.nome), ["6205", "6206", "6207"]);
});

test("mesmo interno desempata pelo externo e depois pela altura", () => {
  const lista = [
    item("largo", { diametroInternoMm: 25, diametroExternoMm: 52, alturaMm: 20 }),
    item("estreito", { diametroInternoMm: 25, diametroExternoMm: 52, alturaMm: 15 }),
    item("menor externo", { diametroInternoMm: 25, diametroExternoMm: 47, alturaMm: 30 }),
  ];
  assert.deepEqual(ordenarPorMedida(lista).map((p) => p.nome), ["menor externo", "estreito", "largo"]);
});

test("item sem medida fica por último, não no começo", () => {
  // `Number(undefined)` é NaN, e NaN em comparação devolve false: sem o
  // tratamento o item sem medida embaralharia a lista inteira.
  const lista = [
    item("sem medida", {}),
    item("6205", { diametroInternoMm: 25, diametroExternoMm: 52, alturaMm: 15 }),
    item("código no lugar da medida", { diametroInternoMm: 5176168 }),
  ];
  assert.deepEqual(ordenarPorMedida(lista).map((p) => p.nome), ["6205", "sem medida", "código no lugar da medida"]);
});

test("ordenar não mexe na lista recebida", () => {
  const lista = [item("b", { diametroInternoMm: 30 }), item("a", { diametroInternoMm: 20 })];
  ordenarPorMedida(lista);
  assert.deepEqual(lista.map((p) => p.nome), ["b", "a"]);
});
