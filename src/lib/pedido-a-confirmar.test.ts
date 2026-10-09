import assert from "node:assert/strict";
import test from "node:test";
import {
  PENDENCIA_VALE_MS, TEXTO_SEM_PEDIDO, chaveDaPendencia, desfechoDoCheckout, destinoAposFalhaDoCheckout, esquecerPendencia, guardarPendencia,
  lerPendencia, lerSituacao, situacaoDaReferencia, telaSemPedido, type GuardaDoNavegador,
} from "./pedido-a-confirmar";

test("pagamento a confirmar leva à página do pedido, pela referência que o servidor devolveu", () => {
  assert.equal(destinoAposFalhaDoCheckout({ codigo: "pagamento_a_confirmar", referencia: "LOJA-ABC-1" }, "LOJA-XYZ-9"), "/pedido/LOJA-ABC-1");
  assert.equal(destinoAposFalhaDoCheckout({ codigo: "pagamento_a_confirmar", referencia: "" }, "LOJA-XYZ-9"), "/pedido/LOJA-XYZ-9");
  assert.equal(destinoAposFalhaDoCheckout({ codigo: "pagamento_a_confirmar" }, "LOJA-XYZ-9"), "/pedido/LOJA-XYZ-9");
  assert.equal(destinoAposFalhaDoCheckout({ codigo: "pagamento_a_confirmar", referencia: "a/../b?x" }, "r"), "/pedido/a%2F..%2Fb%3Fx");
});

test("os demais erros do checkout ficam no formulário", () => {
  for (const corpo of [{ codigo: "falha_gateway" }, { codigo: "endereco_obrigatorio", erro: "Informe o endereço." }, { erro: "x" }, {}, null, undefined, "texto"]) {
    assert.equal(destinoAposFalhaDoCheckout(corpo, "LOJA-XYZ-9"), null, JSON.stringify(corpo));
  }
});

test("página do pedido sem pedido: a tentativa diz se está confirmando, se o pagamento entrou sem pedido, se não concluiu ou se não existe", () => {
  for (const estado of ["INCERTA", "COBRANCA_CRIADA"]) assert.equal(telaSemPedido(estado), "confirmando", estado);
  assert.equal(telaSemPedido("PAGA_SEM_PEDIDO"), "pago_sem_pedido");
  assert.equal(telaSemPedido("LIBERADA"), "nao_concluido");
  for (const estado of ["RESERVADA", "CONFIRMADA", "", null, undefined, "OUTRO"]) assert.equal(telaSemPedido(estado), null, String(estado));
});

test("pagamento recebido sem pedido: a tela não promete que o pedido aparece sozinho e manda falar com a loja", () => {
  const { titulo, texto } = TEXTO_SEM_PEDIDO.pago_sem_pedido;
  assert.equal(titulo, "Pagamento recebido");
  assert.match(texto, /Não pague de novo/);
  assert.match(texto, /a loja foi avisada e vai confirmar o pedido/);
  assert.match(texto, /fale com a loja/);
  assert.doesNotMatch(texto, /volte em alguns minutos|aparece nesta página/);
  // "Confirmando" também deixou de prometer o pedido: cobrança criada com falha ao gravar não gera pedido sozinha.
  assert.doesNotMatch(TEXTO_SEM_PEDIDO.confirmando.texto, /o pedido aparece nesta página/);
  assert.match(TEXTO_SEM_PEDIDO.confirmando.texto, /Não pague de novo/);
  assert.notEqual(TEXTO_SEM_PEDIDO.pago_sem_pedido.texto, TEXTO_SEM_PEDIDO.confirmando.texto);
});

test("resposta 200 que não é um resultado de pagamento não vira erro de formulário: vai para a página do pedido", () => {
  const aprovado = { id: "123", status: "aprovado", meioPagamento: "cartao", valor: 1000 };
  assert.deepEqual(desfechoDoCheckout(true, aprovado, "LOJA-XYZ-9"), { tipo: "resultado", resultado: aprovado });
  assert.equal(desfechoDoCheckout(true, { id: 77, status: "pendente" }, "LOJA-XYZ-9").tipo, "resultado");
  for (const corpo of [null, undefined, "", "<html>", {}, { status: "aprovado" }, { id: "1" }, { id: "1", status: "" }, []]) {
    assert.deepEqual(desfechoDoCheckout(true, corpo, "LOJA/XYZ 9"), { tipo: "a_confirmar", referencia: "LOJA/XYZ 9", destino: "/pedido/LOJA%2FXYZ%209" }, JSON.stringify(corpo));
  }
});

test("resposta não-ok: pagamento a confirmar leva a referência do servidor; o resto é erro do formulário", () => {
  assert.deepEqual(desfechoDoCheckout(false, { codigo: "pagamento_a_confirmar", referencia: "LOJA-ABC-1" }, "LOJA-XYZ-9"), { tipo: "a_confirmar", referencia: "LOJA-ABC-1", destino: "/pedido/LOJA-ABC-1" });
  assert.deepEqual(desfechoDoCheckout(false, { codigo: "pagamento_a_confirmar" }, "LOJA-XYZ-9"), { tipo: "a_confirmar", referencia: "LOJA-XYZ-9", destino: "/pedido/LOJA-XYZ-9" });
  assert.deepEqual(desfechoDoCheckout(false, { codigo: "falha_gateway", erro: "Gateway fora." }, "r"), { tipo: "erro", mensagem: "Gateway fora." });
  for (const corpo of [null, undefined, {}, { erro: 5 }, "texto"]) assert.deepEqual(desfechoDoCheckout(false, corpo, "r"), { tipo: "erro", mensagem: "Não foi possível processar o pagamento." }, JSON.stringify(corpo));
});

function guardaDeTeste(inicial: Record<string, string> = {}) {
  const dados = new Map(Object.entries(inicial));
  const guarda: GuardaDoNavegador = { getItem: (k) => dados.get(k) ?? null, setItem: (k, v) => void dados.set(k, v), removeItem: (k) => void dados.delete(k) };
  return { dados, guarda };
}

test("referência pendente: guardada por loja, lida de volta, e esquecida quando resolve", () => {
  const { dados, guarda } = guardaDeTeste();
  assert.equal(lerPendencia(guarda, "loja-a"), null);
  guardarPendencia(guarda, "loja-a", "LOJA-A-REF-1", 1_000);
  assert.equal(lerPendencia(guarda, "loja-a", 2_000), "LOJA-A-REF-1");
  assert.equal(lerPendencia(guarda, "loja-b", 2_000), null, "a pendência de uma loja não vale em outra");
  assert.deepEqual([...dados.keys()], ["loja:loja-a:pagamento-pendente"]);
  esquecerPendencia(guarda, "loja-a");
  assert.equal(lerPendencia(guarda, "loja-a", 2_000), null);
  assert.equal(dados.size, 0);
});

test("referência pendente: vencida, do futuro ou ilegível não tranca o checkout e é apagada", () => {
  const chave = chaveDaPendencia("loja-a");
  const { dados, guarda } = guardaDeTeste();
  guardarPendencia(guarda, "loja-a", "REF", 0);
  assert.equal(lerPendencia(guarda, "loja-a", PENDENCIA_VALE_MS - 1), "REF");
  assert.equal(lerPendencia(guarda, "loja-a", PENDENCIA_VALE_MS), null);
  assert.equal(dados.has(chave), false);
  for (const bruto of ["{", "null", "[]", '"REF"', '{"referencia":"","em":1}', '{"referencia":"REF"}', '{"referencia":7,"em":1}', '{"referencia":"REF","em":999999}']) {
    const g = guardaDeTeste({ [chave]: bruto });
    assert.equal(lerPendencia(g.guarda, "loja-a", 10), null, bruto);
    assert.equal(g.dados.has(chave), false, bruto);
  }
});

test("referência pendente: storage bloqueado não derruba o checkout", () => {
  const erro = () => { throw new Error("bloqueado"); };
  const guarda: GuardaDoNavegador = { getItem: erro, setItem: erro, removeItem: erro };
  assert.doesNotThrow(() => guardarPendencia(guarda, "loja-a", "REF"));
  assert.doesNotThrow(() => esquecerPendencia(guarda, "loja-a"));
  assert.equal(lerPendencia(guarda, "loja-a"), null);
  // Navegador que recusa até o acesso ao storage: sem guarda nenhuma.
  assert.doesNotThrow(() => guardarPendencia(null, "loja-a", "REF"));
  assert.doesNotThrow(() => esquecerPendencia(null, "loja-a"));
  assert.equal(lerPendencia(null, "loja-a"), null);
});

test("voltar ao checkout com referência pendente: sem pedido e com cobrança possível, o formulário não abre", () => {
  for (const estado of ["INCERTA", "COBRANCA_CRIADA", "PAGA_SEM_PEDIDO"]) assert.equal(situacaoDaReferencia(null, estado), "pendente", estado);
  for (const estado of ["LIBERADA", "RESERVADA", "CONFIRMADA", "", null, undefined]) assert.equal(situacaoDaReferencia(null, estado), "livre", String(estado));
  for (const status of ["AGUARDANDO_PAGAMENTO", "PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"]) assert.equal(situacaoDaReferencia(status, "INCERTA"), "pedido", status);
  for (const status of ["CANCELADO", "ESTORNADO"]) assert.equal(situacaoDaReferencia(status, "COBRANCA_CRIADA"), "livre", status);
});

test("resposta da consulta de pendência: só as três situações valem; o resto é falha de consulta", () => {
  for (const s of ["pendente", "pedido", "livre"]) assert.equal(lerSituacao({ situacao: s }), s);
  for (const corpo of [null, undefined, {}, { situacao: "outra" }, { erro: "x" }, "livre"]) assert.equal(lerSituacao(corpo), null, JSON.stringify(corpo));
});

test("o caminho inteiro: pagamento a confirmar guarda a referência, e o checkout seguinte encontra a mesma", () => {
  const { guarda } = guardaDeTeste();
  const desfecho = desfechoDoCheckout(false, { codigo: "pagamento_a_confirmar", referencia: "LOJA-ABC-1" }, "LOJA-ABC-1");
  assert.equal(desfecho.tipo, "a_confirmar");
  if (desfecho.tipo === "a_confirmar") guardarPendencia(guarda, "loja-a", desfecho.referencia, 1_000);
  // Nova visita ao /checkout: a referência pendente é a mesma, e a tentativa INCERTA segura o formulário.
  const pendente = lerPendencia(guarda, "loja-a", 60_000);
  assert.equal(pendente, "LOJA-ABC-1");
  assert.equal(situacaoDaReferencia(null, "INCERTA"), "pendente");
  // A reconciliação soltou a reserva: o checkout esquece e o formulário volta.
  assert.equal(situacaoDaReferencia(null, "LIBERADA"), "livre");
  esquecerPendencia(guarda, "loja-a");
  assert.equal(lerPendencia(guarda, "loja-a", 61_000), null);
});
