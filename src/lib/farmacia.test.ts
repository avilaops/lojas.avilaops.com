import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AVISO_MEDICAMENTO,
  chaveDaApresentacao,
  chaveDoPrincipio,
  economia,
  ehMedicamento,
  equivalentes,
  exigeReceita,
  exigeRetencao,
  formatarRegistroAnvisa,
  lerMedicamento,
  lerResponsavel,
  lerTarja,
  mesmoPrincipio,
  pendenciasDe,
  registroAnvisaValido,
  responsavelCompleto,
  vendaRemotaProibida,
} from "./farmacia";
import { dispensavelADistancia } from "./produto-regras";
import { TemaSchema, lerTema, LAYOUTS } from "./tema";
import { ProdutoEntradaSchema, TenantEntradaSchema } from "./admin-schemas";

/**
 * A regra que não pode quebrar: medicamento sob controle especial não sai pela
 * internet. Se este teste passar a falhar, a loja está cometendo infração
 * sanitária, não exibindo um botão a mais.
 */
test("controle especial nunca é vendável a distância", () => {
  assert.equal(vendaRemotaProibida("preta"), true);
  assert.equal(vendaRemotaProibida("vermelha-retencao"), true);
  // Tarja vermelha comum PODE ser dispensada a distância, com receita exigida
  // na entrega: bloqueá-la seria tirar da loja a maior parte do que ela vende.
  assert.equal(vendaRemotaProibida("vermelha"), false);
  assert.equal(vendaRemotaProibida("livre"), false);
  assert.equal(vendaRemotaProibida("nenhuma"), false);
});

test("receita e retenção acompanham a tarja", () => {
  assert.deepEqual(
    (["nenhuma", "livre", "vermelha", "vermelha-retencao", "preta"] as const).map(exigeReceita),
    [false, false, true, true, true],
  );
  assert.deepEqual(
    (["nenhuma", "livre", "vermelha", "vermelha-retencao", "preta"] as const).map(exigeRetencao),
    [false, false, false, true, true],
  );
});

test("tarja desconhecida vira 'nenhuma' e não libera nada de novo", () => {
  for (const bruto of [null, undefined, "", "amarela", "TARJA PRETA", 42, {}]) {
    assert.equal(lerTarja(bruto), "nenhuma", String(bruto));
  }
  // Escrita certa continua valendo, com espaço e caixa sobrando.
  assert.equal(lerTarja("  PRETA  "), "preta");
  assert.equal(lerTarja("Vermelha-Retencao"), "vermelha-retencao");
});

test("o que não é medicamento não carrega nada de medicamento", () => {
  const shampoo = lerMedicamento({ nome: "Shampoo" } as never);
  assert.equal(ehMedicamento(shampoo), false);
  assert.deepEqual(pendenciasDe({}), []);
  // Mas basta um sinal de que é remédio para o cadastro passar a ser cobrado.
  assert.equal(ehMedicamento(lerMedicamento({ principioAtivo: "Dipirona" })), true);
  assert.ok(pendenciasDe({ principioAtivo: "Dipirona" }).length > 0);
});

test("o painel cobra o que falta antes de o fiscal cobrar", () => {
  const completo = { tarja: "livre", principioAtivo: "Dipirona monoidratada", apresentacao: "500 mg · 20 comprimidos", registroAnvisa: "1029801230015" };
  assert.deepEqual(pendenciasDe(completo), []);
  assert.equal(pendenciasDe({ ...completo, tarja: "nenhuma" }).length, 1);
  assert.equal(pendenciasDe({ ...completo, registroAnvisa: null }).length, 1);
});

/**
 * O mesmo princípio ativo escrito por três ERPs diferentes. Sem colapsar isso,
 * o genérico só apareceria ao lado do de referência quando o cadastro batesse
 * letra por letra — que é quase nunca.
 */
test("princípio ativo é comparado sem depender da grafia do cadastro", () => {
  assert.ok(mesmoPrincipio("Dipirona Monoidratada", "dipirona mono-hidratada"));
  assert.ok(mesmoPrincipio("DIPIRONA MONOIDRATADA", "Dipirona monoidratada"));
  assert.ok(mesmoPrincipio("Ácido acetilsalicílico", "acido acetilsalicilico"));
  assert.ok(mesmoPrincipio("Cloridrato de metformina", "cloridrato metformina"));
  // O "+" das associações é significativo e não pode ser apagado junto com a
  // pontuação: sulfametoxazol sozinho não é sulfametoxazol + trimetoprima.
  assert.equal(chaveDoPrincipio("Sulfametoxazol + Trimetoprima"), "sulfametoxazol + trimetoprima");
  assert.equal(mesmoPrincipio("Sulfametoxazol + Trimetoprima", "Sulfametoxazol"), false);
  // Vazio nunca casa com vazio: dois produtos sem substância cadastrada não
  // são "o mesmo remédio".
  assert.equal(mesmoPrincipio(null, null), false);
  assert.equal(mesmoPrincipio("", ""), false);
});

test("apresentação normaliza o espaço da unidade, sem converter dose", () => {
  assert.equal(chaveDaApresentacao("500 mg"), chaveDaApresentacao("500mg"));
  assert.equal(chaveDaApresentacao("500 MG · 20 comprimidos"), "500mg 20 comprimidos");
  // 1 g e 1000 mg são a mesma dose na farmácia, mas converter unidade aqui
  // seria adivinhar: na dúvida, não se afirma equivalência.
  assert.notEqual(chaveDaApresentacao("1 g"), chaveDaApresentacao("1000 mg"));
});

test("equivalente é mesma substância e mesma dose", () => {
  const referencia = { principioAtivo: "Dipirona monoidratada", apresentacao: "500 mg · 20 comprimidos" };
  const candidatos = [
    { id: "generico", principioAtivo: "dipirona mono-hidratada", apresentacao: "500mg · 20 comprimidos" },
    { id: "dose-outra", principioAtivo: "Dipirona monoidratada", apresentacao: "1 g · 10 comprimidos" },
    { id: "outra-substancia", principioAtivo: "Paracetamol", apresentacao: "500 mg · 20 comprimidos" },
    // Sem apresentação cadastrada entra assim mesmo: o comprador ainda quer ver
    // a opção, e a tela mostra a apresentação de cada um para ele conferir.
    { id: "sem-apresentacao", principioAtivo: "Dipirona monoidratada", apresentacao: null },
  ];
  assert.deepEqual(equivalentes(referencia, candidatos).map((c) => c.id), ["generico", "sem-apresentacao"]);
  // Produto sem substância cadastrada não puxa o catálogo inteiro.
  assert.deepEqual(equivalentes({ principioAtivo: null }, candidatos), []);
});

test("economia só aparece quando é economia de verdade", () => {
  assert.equal(economia(2000, 1500), 25);
  assert.equal(economia(2000, 2000), null);
  assert.equal(economia(2000, 2500), null);
  // Preço zero é "sob consulta", não "de graça": não dá para dizer que economiza.
  assert.equal(economia(0, 1500), null);
  assert.equal(economia(2000, 0), null);
});

test("registro na Anvisa: 13 dígitos, guardado sem máscara e exibido com ela", () => {
  assert.equal(registroAnvisaValido("1.0298.0123.001-5"), true);
  assert.equal(registroAnvisaValido("1029801230015"), true);
  assert.equal(registroAnvisaValido("102980123"), false);
  assert.equal(registroAnvisaValido(null), false);
  assert.equal(formatarRegistroAnvisa("1029801230015"), "1.0298.0123.001-5");
  // O que não tem 13 dígitos volta como está: melhor exibir o que o lojista
  // digitou do que uma máscara inventada por cima de dado incompleto.
  assert.equal(formatarRegistroAnvisa("em análise"), "em análise");
  assert.equal(formatarRegistroAnvisa(null), null);
});

test("o rodapé nunca inventa um responsável técnico", () => {
  assert.equal(responsavelCompleto(lerResponsavel({})), false);
  assert.equal(responsavelCompleto(lerResponsavel({ farmaceuticoResponsavel: "Maria Souza" })), false);
  assert.equal(responsavelCompleto(lerResponsavel({ farmaceuticoResponsavel: "  ", farmaceuticoCrf: "CRF-SP 1" })), false);
  assert.equal(responsavelCompleto(lerResponsavel({ farmaceuticoResponsavel: "Maria Souza", farmaceuticoCrf: "CRF-SP 12345" })), true);
  // O aviso da Lei 9.294/96 vai em caixa alta, como a norma pede.
  assert.equal(AVISO_MEDICAMENTO, AVISO_MEDICAMENTO.toUpperCase());
});

test("o layout de farmácia é selecionável sem mexer no padrão das outras lojas", () => {
  assert.equal(lerTema({}).layout, "classico");
  assert.ok(LAYOUTS.some((l) => l.valor === "farmacia"));
  assert.equal(lerTema({ layout: "farmacia" }).layout, "farmacia");
  // Layout inexistente não derruba a loja: o schema inteiro cai no padrão.
  assert.equal(lerTema({ layout: "drogaria" }).layout, "classico");
  assert.equal(TemaSchema.safeParse({ layout: "automotivo-premium" }).success, true);
});

test("a API só aceita tarja de um conjunto fechado", () => {
  assert.equal(ProdutoEntradaSchema.safeParse({ nome: "X", precoCentavos: 100, tarja: "preta" }).success, true);
  // Um typo de importação não pode virar uma tarja nova nem passar despercebido
  // como se fosse válida.
  assert.equal(ProdutoEntradaSchema.safeParse({ nome: "X", precoCentavos: 100, tarja: "vermelho" }).success, false);
  assert.equal(ProdutoEntradaSchema.safeParse({ nome: "X", precoCentavos: 100, tipoMedicamento: "milagroso" }).success, false);
});

test("a API normaliza o registro da Anvisa e rejeita o que não tem 13 dígitos", () => {
  const ok = ProdutoEntradaSchema.safeParse({ nome: "X", precoCentavos: 100, registroAnvisa: "1.0298.0123.001-5" });
  assert.equal(ok.success, true);
  assert.equal(ok.success && ok.data.registroAnvisa, "1029801230015");
  assert.equal(ProdutoEntradaSchema.safeParse({ nome: "X", precoCentavos: 100, registroAnvisa: "123" }).success, false);
  // Campo em branco é "não informado", não erro de validação.
  const vazio = ProdutoEntradaSchema.safeParse({ nome: "X", precoCentavos: 100, registroAnvisa: "" });
  assert.equal(vazio.success && vazio.data.registroAnvisa, null);
});

test("farmacia é um segmento aceito, e um ramo inventado não é", () => {
  assert.equal(TenantEntradaSchema.safeParse({ slug: "drogaria", nome: "Drogaria", segmento: "farmacia" }).success, true);
  assert.equal(TenantEntradaSchema.safeParse({ slug: "drogaria", nome: "Drogaria", segmento: "farmacias" }).success, false);
});

/**
 * A trava do servidor, que é a que vale quando alguém posta o id do produto
 * direto no checkout em vez de clicar no botão que a vitrine não mostrou.
 * `resolverItensPadronizados` e a reserva do estoque consultam esta função.
 */
test("o servidor recusa controlado mesmo sem passar pela tela", () => {
  assert.equal(dispensavelADistancia({ tarja: "preta" }), false);
  assert.equal(dispensavelADistancia({ tarja: "vermelha-retencao" }), false);
  assert.equal(dispensavelADistancia({ tarja: "vermelha" }), true);
  assert.equal(dispensavelADistancia({ tarja: "livre" }), true);
  // Produto que não é medicamento (o catálogo inteiro das outras lojas) passa,
  // inclusive quando o campo nem vem na consulta.
  assert.equal(dispensavelADistancia({ tarja: "nenhuma" }), true);
  assert.equal(dispensavelADistancia({}), true);
  assert.equal(dispensavelADistancia({ tarja: null }), true);
  // Um valor estranho no banco não pode virar uma permissão nova nem um
  // bloqueio geral do catálogo.
  assert.equal(dispensavelADistancia({ tarja: "amarela" }), true);
});
