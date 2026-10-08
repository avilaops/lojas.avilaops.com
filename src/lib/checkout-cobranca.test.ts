import assert from "node:assert/strict";
import test from "node:test";
import { CorpoDoCheckout, lerCorpoDoCheckout, paraPayload, PARCELAS_MAXIMAS } from "./checkout-cobranca";

const base = {
  referencia: "LOJA-mfx1-0123456789abcdef0123456789abcdef",
  itens: [{ id: "p1", quantidade: 1 }],
  cliente: { nome: "Maria", sobrenome: "Silva", email: "maria@example.test", telefone: "11999999999", documento: "52998224725" },
  entrega: null,
  freteId: "retirada-na-loja",
  meioPagamento: "pix",
};

test("o cartão aninhado, como a tela manda, vira os campos que o pacote lê", () => {
  // CheckoutClient.tsx manda `cartao: { token, parcelas, bandeira }`; o pacote
  // lê `cartaoToken` na raiz. Sem esta conversão, cartão nenhum passava.
  const lido = CorpoDoCheckout.parse({ ...base, meioPagamento: "cartao", cartao: { token: "tok_1", parcelas: 3, bandeira: "visa" } });
  const p = paraPayload(lido);
  assert.equal(p.cartaoToken, "tok_1");
  assert.equal(p.parcelas, 3);
  assert.equal(p.bandeira, "visa");
});

test("o cartão solto na raiz continua valendo, e sem cartão não aparece campo de cartão", () => {
  const solto = paraPayload(CorpoDoCheckout.parse({ ...base, meioPagamento: "cartao", cartaoToken: "tok_2", parcelas: 2 }));
  assert.equal(solto.cartaoToken, "tok_2");
  assert.equal(solto.parcelas, 2);
  const pix = paraPayload(CorpoDoCheckout.parse(base));
  assert.equal("cartaoToken" in pix, false);
  assert.equal("parcelas" in pix, false);
});

test("o que vier a mais no corpo não passa adiante: preço e total não são do navegador", () => {
  const p = paraPayload(CorpoDoCheckout.parse({ ...base, precoUnitario: 1, total: 1, itens: [{ id: "p1", quantidade: 1, precoUnitario: 1 }] }));
  assert.equal(JSON.stringify(p).includes("precoUnitario"), false);
  assert.equal("total" in p, false);
});

test("parcelas têm teto, meio de pagamento é lista fechada, e o erro aponta o campo", () => {
  assert.equal(CorpoDoCheckout.safeParse({ ...base, meioPagamento: "cartao", cartao: { token: "t", parcelas: PARCELAS_MAXIMAS } }).success, true);
  assert.equal(CorpoDoCheckout.safeParse({ ...base, meioPagamento: "cartao", cartao: { token: "t", parcelas: PARCELAS_MAXIMAS + 1 } }).success, false);
  assert.equal(CorpoDoCheckout.safeParse({ ...base, meioPagamento: "transferencia" }).success, false);

  const semNome = lerCorpoDoCheckout({ ...base, cliente: { ...base.cliente, nome: "" } });
  assert.ok("tipo" in semNome);
  assert.match(semNome.mensagem, /cliente\.nome/);
  assert.ok("tipo" in lerCorpoDoCheckout(null));
  assert.ok("tipo" in lerCorpoDoCheckout("texto"));
});
