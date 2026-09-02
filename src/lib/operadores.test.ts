import { strict as assert } from "node:assert";
import { test } from "node:test";
import { conferirForcaDaSenha, ErroOperador, normalizarEmail, PAPEIS, PODE, permite } from "./operadores";

/**
 * As regras de quem pode o quê. É onde um erro passa despercebido e vira
 * balconista mexendo em preço, ou gerente cancelando a assinatura da loja.
 */

test("o dono pode tudo", () => {
  for (const o_que of Object.keys(PODE) as Array<keyof typeof PODE>) {
    assert.equal(permite("DONO", o_que), true, `dono deveria poder ${o_que}`);
  }
});

test("gerente cuida da loja, mas não da cobrança", () => {
  assert.equal(permite("GERENTE", "catalogo"), true);
  assert.equal(permite("GERENTE", "pedidos"), true);
  assert.equal(permite("GERENTE", "configuracoes"), true);
  assert.equal(permite("GERENTE", "cobranca"), false);
});

test("gerente não cria acesso", () => {
  // Quem tem acesso hoje não pode garantir acesso para sempre: seria um jeito
  // de continuar entrando depois de ser desligado.
  assert.equal(permite("GERENTE", "equipe"), false);
});

test("balcão vê pedido e não mexe em preço", () => {
  assert.equal(permite("OPERADOR", "pedidos"), true);
  assert.equal(permite("OPERADOR", "catalogo"), false);
  assert.equal(permite("OPERADOR", "configuracoes"), false);
  assert.equal(permite("OPERADOR", "cobranca"), false);
  assert.equal(permite("OPERADOR", "equipe"), false);
});

test("só o dono mexe em cobrança e em acessos", () => {
  assert.deepEqual([...PODE.cobranca], ["DONO"]);
  assert.deepEqual([...PODE.equipe], ["DONO"]);
});

test("todo papel enxerga pedido: é o trabalho do dia", () => {
  assert.equal(permite("DONO", "pedidos"), true);
  assert.equal(permite("GERENTE", "pedidos"), true);
  assert.equal(permite("OPERADOR", "pedidos"), true);
});

test("a tela não oferece criar outro dono", () => {
  // O dono é o Tenant.loginEmail, e não um operador: oferecer o papel na tela
  // criaria duas contas donas da mesma loja, sem dizer qual manda.
  assert.deepEqual(PAPEIS.map((p) => p.valor).sort(), ["GERENTE", "OPERADOR"]);
});

test("cada papel oferecido explica o que faz", () => {
  for (const p of PAPEIS) {
    assert.ok(p.rotulo.length > 2, `${p.valor} sem rótulo`);
    assert.ok(p.explica.length > 20, `${p.valor} sem explicação`);
  }
});

test("e-mail é comparado sem caixa nem espaço", () => {
  // "Joao@Loja.com " e "joao@loja.com" são a mesma pessoa; tratar como duas
  // deixaria dois acessos com senhas diferentes para o mesmo e-mail.
  assert.equal(normalizarEmail("  Joao@Loja.com "), "joao@loja.com");
});

test("senha curta é recusada com motivo", () => {
  assert.throws(() => conferirForcaDaSenha("1234567"), ErroOperador);
  assert.throws(() => conferirForcaDaSenha("1234567"), /8 caracteres/);
});

test("senha de oito caracteres passa, sem exigir símbolo", () => {
  // Regra complicada demais leva a pessoa a escrever a senha num papel colado
  // no monitor do balcão, que é pior que uma senha simples.
  assert.doesNotThrow(() => conferirForcaDaSenha("bancada2026"));
  assert.doesNotThrow(() => conferirForcaDaSenha("12345678"));
});
