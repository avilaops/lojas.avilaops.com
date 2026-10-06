import assert from "node:assert/strict";
import test from "node:test";
import {
  chaveDaRequisicao,
  chaveMascarada,
  escoposDaChave,
  gerarChave,
  hashDaChave,
  lojaNoAr,
  planoPermite,
  tipoPeloFormato,
} from "./api-chaves";
import { LimitadorPorJanela } from "./api-limite";
import { ErroApi, lerBooleano, lerData, lerOpcao, lerPaginacao, lista } from "./api-resposta";
import { produtoDaVitrine } from "./api-recursos";

test("chave gerada tem o prefixo do tipo, 40 hex e se reconhece pelo formato", () => {
  const s = gerarChave("SECRETA");
  const p = gerarChave("PUBLICAVEL");
  assert.match(s.chave, /^lojas_sk_[0-9a-f]{40}$/);
  assert.match(p.chave, /^lojas_pk_[0-9a-f]{40}$/);
  assert.equal(tipoPeloFormato(s.chave), "SECRETA");
  assert.equal(tipoPeloFormato(p.chave), "PUBLICAVEL");
  assert.equal(tipoPeloFormato("lojas_live_loja_abc"), null, "a chave antiga do MCP não é chave da API");
  assert.notEqual(gerarChave("SECRETA").chave, s.chave);
});

test("o banco guarda o hash, e a máscara não contém o miolo da chave", () => {
  const g = gerarChave("SECRETA");
  assert.equal(g.hash, hashDaChave(g.chave));
  assert.equal(g.hash.length, 64);
  const mascara = chaveMascarada(g);
  assert.ok(mascara.startsWith("lojas_sk_") && mascara.endsWith(g.chave.slice(-4)));
  assert.ok(mascara.length < 25);
});

test("publicável fica só com a vitrine, peça o que pedir", () => {
  assert.deepEqual(escoposDaChave("PUBLICAVEL", ["pedidos:ler", "catalogo:ler", "catalogo:escrever"]), ["vitrine:ler"]);
});

test("secreta fica com o que pediu, dentro do catálogo, e sempre com a vitrine", () => {
  assert.deepEqual(escoposDaChave("SECRETA", ["pedidos:ler", "admin:tudo", "pedidos:escrever"]), ["pedidos:ler", "vitrine:ler"]);
  assert.deepEqual(escoposDaChave("SECRETA", ["catalogo:escrever"]), ["catalogo:escrever", "vitrine:ler"]);
  assert.deepEqual(escoposDaChave("SECRETA", []), ["vitrine:ler"]);
});

test("secreta é do Loja Pro; publicável serve a qualquer plano", () => {
  assert.equal(planoPermite("SECRETA", "LOJA_PRO"), true);
  assert.equal(planoPermite("SECRETA", "LOJA"), false);
  assert.equal(planoPermite("PUBLICAVEL", "SITE"), true);
});

test("loja suspensa continua no ar (vitrine sem checkout); provisionando e cancelada não", () => {
  assert.equal(lojaNoAr("ATIVA"), true);
  assert.equal(lojaNoAr("SUSPENSA"), true);
  assert.equal(lojaNoAr("PROVISIONANDO"), false);
  assert.equal(lojaNoAr("CANCELADA"), false);
});

test("chave vem do Bearer ou do x-api-key; na URL, só a publicável", () => {
  const sk = gerarChave("SECRETA").chave;
  const pk = gerarChave("PUBLICAVEL").chave;
  assert.equal(chaveDaRequisicao(new Request("https://x/api/v1/loja", { headers: { authorization: `Bearer ${sk}` } })), sk);
  assert.equal(chaveDaRequisicao(new Request("https://x/api/v1/loja", { headers: { "x-api-key": sk } })), sk);
  assert.equal(chaveDaRequisicao(new Request(`https://x/api/v1/vitrine/produtos?chave=${pk}`)), pk);
  assert.equal(chaveDaRequisicao(new Request(`https://x/api/v1/produtos?chave=${sk}`)), "", "secreta na URL vaza em log e Referer");
});

test("limitador conta por chave e reabre a janela depois de um minuto", () => {
  let agora = 0;
  const l = new LimitadorPorJanela(() => agora);
  assert.equal(l.consumir("a", 2).restante, 1);
  assert.equal(l.consumir("a", 2).restante, 0);
  const barrado = l.consumir("a", 2);
  assert.equal(barrado.permitido, false);
  assert.equal(barrado.reiniciaEm, 60);
  assert.equal(l.consumir("b", 2).permitido, true, "uma chave não gasta o limite da outra");
  agora = 60_000;
  assert.equal(l.consumir("a", 2).permitido, true);
});

test("paginação: padrão, máximo e erro em vez de correção silenciosa", () => {
  assert.deepEqual(lerPaginacao(new URLSearchParams()), { pagina: 1, porPagina: 50, pular: 0 });
  assert.deepEqual(lerPaginacao(new URLSearchParams("pagina=3&porPagina=20")), { pagina: 3, porPagina: 20, pular: 40 });
  assert.throws(() => lerPaginacao(new URLSearchParams("porPagina=500")), (e: unknown) => e instanceof ErroApi && e.status === 400);
  assert.throws(() => lerPaginacao(new URLSearchParams("pagina=0")), ErroApi);
  assert.throws(() => lerPaginacao(new URLSearchParams("pagina=-1")), ErroApi);
  assert.deepEqual(lista([1, 2], { pagina: 1, porPagina: 2, pular: 0 }, 5).paginacao, { pagina: 1, porPagina: 2, total: 5, totalPaginas: 3 });
});

test("filtros fechados recusam valor desconhecido", () => {
  assert.equal(lerBooleano(new URLSearchParams("ativo=true"), "ativo"), true);
  assert.throws(() => lerBooleano(new URLSearchParams("ativo=sim"), "ativo"), ErroApi);
  assert.equal(lerOpcao(new URLSearchParams("status=PAGO"), "status", ["PAGO", "ENVIADO"] as const), "PAGO");
  assert.throws(() => lerOpcao(new URLSearchParams("status=pago"), "status", ["PAGO"] as const), ErroApi);
  assert.equal(lerData(new URLSearchParams("d=2026-10-01"), "d")?.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.throws(() => lerData(new URLSearchParams("d=ontem"), "d"), ErroApi);
});

function produto(extra: Record<string, unknown> = {}) {
  return {
    id: "p1", slug: "dipirona", nome: "Dipirona", marca: null, categoria: null,
    precoCentavos: 1290, precoDeCentavos: null, imagens: [], descricaoCurta: null, destaque: false,
    ativo: true, disponibilidade: "in_stock", estoque: 2, tarja: "nenhuma",
    ...extra,
  } as unknown as Parameters<typeof produtoDaVitrine>[0];
}

test("vitrine não publica a contagem de estoque, só 'últimas unidades'", () => {
  const v = produtoDaVitrine(produto(), { url: "https://loja", vende: true });
  assert.equal("estoque" in v, false);
  assert.equal(v.venda.ultimasUnidades, true);
  assert.equal(v.venda.acao, "carrinho");
  assert.equal(v.url, "https://loja/produtos/dipirona");
});

test("vitrine: sem preço sai nulo, não zero (zero vira 'Grátis' num front alheio)", () => {
  const v = produtoDaVitrine(produto({ precoCentavos: 0 }), { url: "https://loja", vende: true });
  assert.equal(v.precoCentavos, null);
  assert.equal(v.venda.acao, "consulta-preco");
});

test("vitrine: controle especial aparece, mas a ação é 'somente-na-loja' (RDC 44/2009)", () => {
  const v = produtoDaVitrine(produto({ tarja: "preta" }), { url: "https://loja", vende: true });
  assert.equal(v.venda.acao, "somente-na-loja");
  assert.equal(v.precoCentavos, 1290);
});
