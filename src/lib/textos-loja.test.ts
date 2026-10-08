import assert from "node:assert/strict";
import test from "node:test";
import { descricaoDaLoja, descricaoDaPagina } from "./textos-loja";

/**
 * Medido na PK Vedações em 07/10/2026: sem slogan, a home saía no Google como
 * "Loja virtual PK Vedações", com o "Sobre" dizendo o que a loja vende.
 */
test("sem slogan, a descrição vem do diferencial ou do Sobre, não de 'Loja virtual'", () => {
  const sobre = "Gaxetas e raspadores para cilindros hidráulicos e pneumáticos — catálogo técnico completo.\n\nSegundo parágrafo.";
  assert.equal(descricaoDaLoja({ nome: "PK Vedações", slogan: null, sobre }, ""), "Gaxetas e raspadores para cilindros hidráulicos e pneumáticos — catálogo técnico completo.");
  assert.equal(descricaoDaLoja({ nome: "PK Vedações", slogan: null, sobre }, "Vedação sob medida."), "Vedação sob medida.");
});

test("slogan escrito vence tudo; em branco conta como ausente", () => {
  assert.equal(descricaoDaLoja({ nome: "Loja", slogan: "Pix na hora", sobre: "Texto" }, "Dif"), "Pix na hora");
  assert.equal(descricaoDaLoja({ nome: "Loja", slogan: "   ", sobre: "Texto do sobre" }, null), "Texto do sobre");
});

test("'Loja virtual' só quando não há nada escrito", () => {
  assert.equal(descricaoDaLoja({ nome: "Loja", slogan: null, sobre: null }), "Loja virtual Loja");
});

test("o Sobre é resumido ao tamanho do resultado de busca", () => {
  const longo = "palavra ".repeat(60).trim();
  const r = descricaoDaLoja({ nome: "Loja", slogan: null, sobre: longo });
  assert.ok(r.length <= 156 && r.endsWith("…"), r);
});

/**
 * Medido na PK Vedações em 08/10/2026: /sobre, /contato e as quatro políticas
 * saíam com a mesma meta description da home.
 */
const PAGINAS = ["sobre", "contato", "envio", "devolucao", "privacidade", "termos", "aviso-legal"] as const;

test("cada página institucional tem descrição própria, com o nome da loja e até 155 caracteres", () => {
  const loja = { nome: "PK Vedações", endereco: { cidade: "Ribeirão Preto", uf: "sp" }, whatsapp: "5516999990000", telefone: null, emailContato: "contato@pk.com.br", horario: "Seg a sex, 8h às 18h" };
  const todas = PAGINAS.map((p) => descricaoDaPagina(loja, p));
  assert.equal(new Set(todas).size, PAGINAS.length);
  for (const d of todas) {
    assert.ok(d.includes("PK Vedações"), d);
    assert.ok(d.length <= 155, `${d.length}: ${d}`);
  }
  assert.equal(descricaoDaPagina(loja, "sobre"), "Conheça a PK Vedações, em Ribeirão Preto/SP: quem somos, o que oferecemos e como atendemos.");
  assert.equal(descricaoDaPagina(loja, "contato"), "Fale com a PK Vedações, em Ribeirão Preto/SP: WhatsApp, e-mail e horário de atendimento.");
  assert.equal(descricaoDaPagina(loja, "envio"), "Política de envio da PK Vedações, a partir de Ribeirão Preto/SP: despacho, formas de entrega, frete e acompanhamento do pedido.");
});

test("sem cidade e sem canal a frase continua inteira, sem inventar", () => {
  const loja = { nome: "Loja", endereco: null };
  assert.equal(descricaoDaPagina(loja, "sobre"), "Conheça a Loja: quem somos, o que oferecemos e como atendemos.");
  assert.equal(descricaoDaPagina(loja, "contato"), "Fale com a Loja: canais de atendimento.");
  assert.equal(descricaoDaPagina({ nome: "Loja", endereco: { cidade: "Franca" }, telefone: "1633334444" }, "contato"), "Fale com a Loja, em Franca: telefone.");
  // Endereço é JSON livre: valor estragado não derruba a página.
  assert.equal(descricaoDaPagina({ nome: "Loja", endereco: { cidade: 12 } }, "sobre"), "Conheça a Loja: quem somos, o que oferecemos e como atendemos.");
});

test("nome longo: a cidade sai primeiro, e o que sobrar é cortado em 155", () => {
  const nome = "Distribuidora Nacional de Componentes Hidráulicos e Pneumáticos do Interior Paulista";
  const d = descricaoDaPagina({ nome, endereco: { cidade: "São José do Rio Preto", uf: "SP" } }, "envio");
  assert.ok(!d.includes("Rio Preto"), d);
  assert.ok(d.length <= 155, `${d.length}: ${d}`);
  const enorme = descricaoDaPagina({ nome: `${nome} ${nome}`, endereco: null }, "privacidade");
  assert.ok(enorme.length <= 155 && enorme.endsWith("…"), enorme);
});
