import assert from "node:assert/strict";
import test from "node:test";
import { noEnderecoOficial } from "./tenant";

/**
 * Só o endereço oficial da loja pode ser indexado.
 *
 * Uma loja com domínio próprio continua respondendo no subdomínio da
 * plataforma, e ali é cópia. O canonical já aponta para o certo, mas canonical
 * é sugestão: sem `noindex` o subdomínio pode ser indexado e competir com o
 * endereço da marca pela mesma busca.
 *
 * Regressão de mudança compartilhada: vale para todas as lojas, não só para a
 * Brilhax. Errar para o outro lado — marcar a loja de verdade como noindex —
 * tira a loja do Google inteira, então os dois sentidos são testados.
 */

const comDominio = { dominioPrincipal: "brilhax.com" } as never;
const semDominio = { dominioPrincipal: null } as never;

test("o domínio próprio é o endereço oficial", () => {
  assert.equal(noEnderecoOficial(comDominio, "brilhax.com"), true);
});

test("o www do domínio próprio também é oficial", () => {
  assert.equal(noEnderecoOficial(comDominio, "www.brilhax.com"), true);
});

test("o subdomínio da plataforma NÃO é oficial quando há domínio próprio", () => {
  assert.equal(noEnderecoOficial(comDominio, "brilhax.lojas.avilaops.com"), false);
});

test("sem domínio próprio, o subdomínio É o endereço oficial", () => {
  // É o caso da loja em homologação, antes da virada: ali ela deve ser
  // indexável, senão a loja nasce fora do Google.
  assert.equal(noEnderecoOficial(semDominio, "brilhax.lojas.avilaops.com"), true);
});

test("porta e ponto final no host não mudam a resposta", () => {
  assert.equal(noEnderecoOficial(comDominio, "brilhax.com:443"), true);
  assert.equal(noEnderecoOficial(comDominio, "brilhax.com."), true);
});

test("maiúsculas no Host não mudam a resposta", () => {
  assert.equal(noEnderecoOficial(comDominio, "BRILHAX.COM"), true);
});

test("host de outra loja não passa por oficial", () => {
  assert.equal(noEnderecoOficial(comDominio, "vedashow.com.br"), false);
});

test("host ausente não vira endereço oficial", () => {
  assert.equal(noEnderecoOficial(comDominio, null), false);
});
