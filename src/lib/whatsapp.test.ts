import assert from "node:assert/strict";
import { test } from "node:test";
import { limparParametro, numeroParaMeta } from "./whatsapp";
import { whatsappDoEvento } from "./whatsapp-do-evento";

test("número brasileiro sem país ganha o 55", () => {
  // O que está no banco veio de formulário, em cinco formatos diferentes.
  assert.equal(numeroParaMeta("16999990000"), "5516999990000");
  assert.equal(numeroParaMeta("(16) 99999-0000"), "5516999990000");
  assert.equal(numeroParaMeta("1633334444"), "551633334444");
});

test("número que já tem o país não ganha outro", () => {
  assert.equal(numeroParaMeta("5516999990000"), "5516999990000");
  assert.equal(numeroParaMeta("+55 16 99999-0000"), "5516999990000");
  assert.equal(numeroParaMeta("551633334444"), "551633334444");
});

test("número que não dá para saber é recusado, não chutado", () => {
  // Mandar para o lugar errado é pior do que não mandar.
  assert.equal(numeroParaMeta("99999-0000"), null, "sem DDD");
  assert.equal(numeroParaMeta("123"), null);
  assert.equal(numeroParaMeta(""), null);
  assert.equal(numeroParaMeta(null), null);
  assert.equal(numeroParaMeta(undefined), null);
  assert.equal(numeroParaMeta("não tenho"), null);
});

test("parâmetro de template não leva quebra de linha", () => {
  // A Meta recusa a mensagem inteira com (#132000) se houver \n no parâmetro.
  assert.equal(limparParametro("2x Correia\n1x Filtro"), "2x Correia 1x Filtro");
  assert.equal(limparParametro("  espaço   demais  "), "espaço demais");
  assert.equal(limparParametro("a".repeat(2000)).length, 900);
});

test("pedido pago avisa o lojista, não o comprador", () => {
  // É ele que separa e envia; o comprador recebe o e-mail de confirmação.
  const m = whatsappDoEvento({
    tipo: "pedido.pago",
    numero: 12,
    totalCentavos: 18990,
    clienteNome: "Ana Silva",
    clienteTelefone: "16988887777",
    itensTexto: "2x Camiseta básica, 1x Boné",
    lojistaWhatsapp: "16999990000",
    lojaNome: "Padaria Aurora",
  });
  assert.ok(m);
  assert.equal(m.template, "pedido_pago_lojista");
  assert.equal(m.para, "16999990000", "foi para o comprador em vez do lojista");
  assert.deepEqual(m.parametros, ["12", "189,90", "Ana Silva", "2x Camiseta básica, 1x Boné"]);
});

test("o valor vai sem o R$, porque o template já escreve", () => {
  const m = whatsappDoEvento({
    tipo: "pedido.pago", numero: 1, totalCentavos: 100000, lojistaWhatsapp: "16999990000",
    clienteNome: "X", itensTexto: "1x Y",
  });
  assert.ok(m);
  assert.equal(m.parametros[1], "1.000,00");
  assert.ok(!m.parametros[1].includes("R$"));
});

test("carrinho abandonado trata o comprador pelo primeiro nome", () => {
  const m = whatsappDoEvento({
    tipo: "carrinho.abandonado",
    clienteNome: "Ana Maria Silva",
    clienteTelefone: "16988887777",
    lojaNome: "Padaria Aurora",
    itensTexto: "1x Bolo",
    totalCentavos: 4500,
    linkCarrinho: "https://padariaaurora.example/carrinho?r=abc",
  });
  assert.ok(m);
  assert.equal(m.template, "carrinho_abandonado");
  assert.deepEqual(m.parametros, ["Ana", "Padaria Aurora", "1x Bolo", "45,00", "https://padariaaurora.example/carrinho?r=abc"]);
});

test("sem número de destino não há mensagem — e não é falha", () => {
  // Loja sem WhatsApp cadastrado, comprador que não deixou telefone.
  assert.equal(whatsappDoEvento({ tipo: "pedido.pago", numero: 1, totalCentavos: 10, itensTexto: "x", clienteNome: "y" }), null);
  assert.equal(whatsappDoEvento({ tipo: "carrinho.abandonado", clienteTelefone: "", lojaNome: "X" }), null);
  assert.equal(whatsappDoEvento({ tipo: "loja.criada", nome: "X", url: "https://x.com" }), null);
});

test("faltando parâmetro do template, a mensagem não é montada pela metade", () => {
  // Melhor não mandar do que a Meta recusar com (#132000) e ninguém ver.
  assert.equal(
    whatsappDoEvento({ tipo: "carrinho.abandonado", clienteTelefone: "16988887777", lojaNome: "X", itensTexto: "1x Y", totalCentavos: 100 }),
    null,
    "montou sem o link do carrinho",
  );
});

test("tipo sem template não vira WhatsApp", () => {
  assert.equal(whatsappDoEvento({ tipo: "pedido.entregue", clienteTelefone: "16988887777" }), null);
  assert.equal(whatsappDoEvento({ tipo: "lojista.recuperar-senha" }), null);
  assert.equal(whatsappDoEvento({}), null);
});

test("loja criada e loja configurada usam templates diferentes", () => {
  const base = { nome: "Padaria Aurora", url: "https://padariaaurora.example", whatsapp: "16999990000" };
  assert.equal(whatsappDoEvento({ ...base, tipo: "loja.criada" })?.template, "loja_no_ar");
  assert.equal(whatsappDoEvento({ ...base, tipo: "loja.provisionada" })?.template, "loja_configurada");
});
