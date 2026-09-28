import { test } from "node:test";
import assert from "node:assert/strict";
import {
  JANELA_ATRIBUICAO_DIAS,
  atribuirPedido,
  classificarDispositivo,
  classificarOrigem,
  novaChave,
  type SessaoParaAtribuir,
} from "./atribuicao";

const LOJA = "minhaloja.com.br";

function origem(url: string, referrer: string | null = null) {
  return classificarOrigem({ parametros: new URL(url).searchParams, referrer, hostDaLoja: LOJA });
}

test("sem utm e sem referrer é direto", () => {
  const o = origem("https://minhaloja.com.br/");
  assert.equal(o.canal, "direto");
  assert.equal(o.origem, null);
});

test("navegação dentro da própria loja não inventa origem nova", () => {
  assert.equal(origem("https://minhaloja.com.br/produtos", "https://minhaloja.com.br/").canal, "direto");
  // Com www no referrer é a mesma loja.
  assert.equal(origem("https://minhaloja.com.br/produtos", "https://www.minhaloja.com.br/").canal, "direto");
});

test("referrer de buscador vira busca orgânica", () => {
  for (const r of ["https://www.google.com/", "https://www.google.com.br/search?q=x", "https://duckduckgo.com/", "https://br.search.yahoo.com/"]) {
    assert.equal(origem("https://minhaloja.com.br/", r).canal, "busca-organica", r);
  }
});

test("WhatsApp é canal próprio, e não “indicação de outro site”", () => {
  // No Brasil o link mandado no WhatsApp é um dos maiores canais de loja
  // pequena; jogá-lo em "referência" apagaria justamente o que o lojista faz.
  assert.equal(origem("https://minhaloja.com.br/", "https://api.whatsapp.com/").canal, "whatsapp");
  assert.equal(origem("https://minhaloja.com.br/", "https://wa.me/5511999999999").canal, "whatsapp");
  assert.equal(origem("https://minhaloja.com.br/", "https://t.me/canal").canal, "whatsapp");
});

test("redes sociais e marketplaces são separados de referência", () => {
  assert.equal(origem("https://minhaloja.com.br/", "https://l.instagram.com/").canal, "social");
  assert.equal(origem("https://minhaloja.com.br/", "https://www.tiktok.com/").canal, "social");
  assert.equal(origem("https://minhaloja.com.br/", "https://produto.mercadolivre.com.br/x").canal, "marketplace");
  assert.equal(origem("https://minhaloja.com.br/", "https://blogdomecanico.com.br/post").canal, "referencia");
});

/**
 * utm vence referrer porque o referrer de link marcado costuma mentir: link
 * de e-mail aberto fora do cliente chega sem referrer, link do Instagram chega
 * como l.instagram.com mesmo quando é anúncio.
 */
test("utm vence referrer", () => {
  const o = origem("https://minhaloja.com.br/?utm_source=newsletter&utm_medium=email", "https://www.google.com/");
  assert.equal(o.canal, "email");
  assert.equal(o.origem, "newsletter");
  assert.equal(o.midia, "email");
});

test("mídia paga é separada da orgânica", () => {
  assert.equal(origem("https://minhaloja.com.br/?utm_medium=cpc&utm_source=google").canal, "busca-paga");
  assert.equal(origem("https://minhaloja.com.br/?utm_medium=paid_social&utm_source=meta").canal, "social-pago");
  assert.equal(origem("https://minhaloja.com.br/?utm_medium=organic&utm_source=google").canal, "busca-organica");
  assert.equal(origem("https://minhaloja.com.br/?utm_medium=social&utm_source=instagram").canal, "social");
});

/**
 * Clique de anúncio que chegou sem utm. Classificá-lo como orgânico faria o
 * relatório dizer que o anúncio não traz ninguém — que é o erro mais caro que
 * um relatório de atribuição pode cometer.
 */
test("gclid e fbclid sem utm não viram orgânico", () => {
  assert.equal(origem("https://minhaloja.com.br/?gclid=abc123").canal, "busca-paga");
  assert.equal(origem("https://minhaloja.com.br/?fbclid=abc123").canal, "social-pago");
  assert.equal(origem("https://minhaloja.com.br/?ttclid=abc123").canal, "social-pago");
});

test("campanha, termo e conteúdo são guardados quando vêm", () => {
  const o = origem("https://minhaloja.com.br/?utm_source=google&utm_medium=cpc&utm_campaign=natal&utm_term=filtro+de+oleo&utm_content=anuncio-b");
  assert.equal(o.campanha, "natal");
  assert.equal(o.termo, "filtro de oleo");
  assert.equal(o.conteudo, "anuncio-b");
});

test("referrer inválido não derruba a classificação", () => {
  assert.equal(origem("https://minhaloja.com.br/", "nao-e-url").canal, "direto");
  assert.equal(origem("https://minhaloja.com.br/", "").canal, "direto");
});

test("dispositivo sai do user-agent, que não é guardado", () => {
  assert.equal(classificarDispositivo("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit Mobile/15E148"), "celular");
  assert.equal(classificarDispositivo("Mozilla/5.0 (Linux; Android 14; SM-A536E) Mobile Safari"), "celular");
  assert.equal(classificarDispositivo("Mozilla/5.0 (iPad; CPU OS 17_0) AppleWebKit"), "tablet");
  assert.equal(classificarDispositivo("Mozilla/5.0 (Windows NT 10.0; Win64; x64)"), "computador");
  assert.equal(classificarDispositivo(null), "computador");
});

test("a chave de cookie é opaca e não se repete", () => {
  const chaves = new Set(Array.from({ length: 200 }, novaChave));
  assert.equal(chaves.size, 200);
  assert.match(novaChave(), /^[\w-]{22}$/);
});

// ── Último clique não direto ────────────────────────────────────────────

const DIA = 86_400_000;
const compra = new Date("2026-09-17T12:00:00Z");
const sessao = (id: string, canal: string, diasAtras: number): SessaoParaAtribuir => ({
  id,
  visitante: "v1",
  canal,
  origem: null,
  campanha: null,
  criadoEm: new Date(compra.getTime() - diasAtras * DIA),
});

/**
 * O caso que justifica o modelo inteiro: clicou no anúncio na segunda, voltou
 * digitando o endereço na quinta. Creditar a sessão da compra daria todo o
 * crédito a "Direto" e nenhum ao anúncio que pagou por ela.
 */
test("o crédito vai para o último canal identificável, não para a sessão da compra", () => {
  const anuncio = sessao("s1", "busca-paga", 3);
  const daCompra = sessao("s2", "direto", 0);
  assert.equal(atribuirPedido(daCompra, [anuncio, daCompra], compra)?.id, "s1");
});

test("sem nenhum canal identificável, a sessão da compra fica com o crédito", () => {
  const daCompra = sessao("s2", "direto", 0);
  assert.equal(atribuirPedido(daCompra, [sessao("s1", "direto", 5), daCompra], compra)?.id, "s2");
});

test("clique mais velho que a janela não leva mais o crédito", () => {
  const antigo = sessao("s1", "social", JANELA_ATRIBUICAO_DIAS + 5);
  const daCompra = sessao("s2", "direto", 0);
  assert.equal(atribuirPedido(daCompra, [antigo, daCompra], compra)?.id, "s2");
});

test("entre dois cliques identificáveis, vence o mais recente", () => {
  const velho = sessao("s1", "social", 10);
  const novo = sessao("s2", "busca-paga", 2);
  const daCompra = sessao("s3", "direto", 0);
  assert.equal(atribuirPedido(daCompra, [velho, novo, daCompra], compra)?.id, "s2");
});

test("sessão posterior à compra não é contada", () => {
  const depois: SessaoParaAtribuir = { ...sessao("s9", "busca-paga", 0), criadoEm: new Date(compra.getTime() + DIA) };
  const daCompra = sessao("s2", "direto", 0);
  assert.equal(atribuirPedido(daCompra, [depois, daCompra], compra)?.id, "s2");
});

/**
 * Pedido anterior à medição, compra com cookie recusado, venda criada fora do
 * site. Devolver null é o que faz a tela declarar esses pedidos em vez de
 * distribuí-los entre canais que ninguém mediu.
 */
test("pedido sem sessão nenhuma não recebe canal inventado", () => {
  assert.equal(atribuirPedido(null, [], compra), null);
});
