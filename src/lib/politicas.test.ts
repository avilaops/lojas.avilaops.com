import { test } from "node:test";
import assert from "node:assert/strict";
import type { Tenant } from "@prisma/client";
import {
  PRAZO_LEGAL_DIAS,
  emParagrafos,
  lerPoliticasEscritas,
  lerRegrasDevolucao,
  modeloDePolitica,
  politicaPublicada,
  politicasPublicadas,
} from "./politicas";

/** Loja mínima: só o que os modelos leem. */
function loja(extra: Partial<Tenant> = {}): Tenant {
  return {
    nome: "Loja Teste",
    razaoSocial: null,
    cnpj: null,
    emailContato: "contato@loja.com.br",
    whatsapp: null,
    endereco: null,
    retiradaNaLoja: true,
    despachoDiasUteis: 1,
    politicas: {},
    regrasDevolucao: {},
    ...extra,
  } as unknown as Tenant;
}

/**
 * A regra que não pode quebrar: art. 49 do CDC dá 7 dias de arrependimento com
 * devolução integral. Se este teste passar a falhar, a plataforma está
 * publicando política ilegal em nome do lojista.
 */
test("o prazo legal de arrependimento é piso, não configuração", () => {
  // Tentativa de encurtar (por bug, importação ou chamada direta na API).
  assert.equal(lerRegrasDevolucao({ prazoDias: 3 }).prazoDias, PRAZO_LEGAL_DIAS);
  assert.equal(lerRegrasDevolucao({ prazoDias: 0 }).prazoDias, PRAZO_LEGAL_DIAS);
  assert.equal(lerRegrasDevolucao({ prazoDias: -30 }).prazoDias, PRAZO_LEGAL_DIAS);
  // Alargar é livre: cortesia maior que a lei é permitida.
  assert.equal(lerRegrasDevolucao({ prazoDias: 30 }).prazoDias, 30);
});

test("taxa de reposição e frete de retorno nunca alcançam a janela legal", () => {
  const t = loja({ regrasDevolucao: { prazoDias: 30, taxaReposicaoPct: 20, freteRetornoCortesia: "cliente" } });
  const texto = modeloDePolitica(t, "devolucao");

  // O primeiro parágrafo é o direito, e ele é integral, sem condição.
  assert.match(texto[0], new RegExp(`${PRAZO_LEGAL_DIAS} dias corridos`));
  assert.match(texto[0], /integralmente/);
  assert.match(texto[0], /frete de retorno é por nossa conta/);
  assert.doesNotMatch(texto[0], /20%/);

  // A taxa só aparece depois, descrita como cortesia.
  const cortesia = texto.find((p) => p.includes("cortesia"));
  assert.ok(cortesia, "a janela de cortesia precisa estar escrita");
  assert.match(cortesia, /30º dia/);
  assert.match(cortesia, /20%/);
  assert.match(cortesia, /por conta do cliente/);
});

test("sem cortesia configurada, a política não inventa condição nenhuma", () => {
  const texto = modeloDePolitica(loja(), "devolucao");
  assert.equal(texto.some((p) => p.includes("cortesia")), false);
  assert.equal(texto.some((p) => p.includes("venda final")), false);
  assert.equal(texto.some((p) => p.includes("cancelado em até")), false);
  // O defeito (art. 26) vale sempre, com ou sem regra do lojista.
  assert.ok(texto.some((p) => p.includes("90 dias")));
});

test("venda final e cancelamento só viram frase quando existem", () => {
  const t = loja({ regrasDevolucao: { categoriasVendaFinal: ["ponta-de-estoque"], cancelamentoHoras: 2 } });
  const texto = modeloDePolitica(t, "devolucao");
  const vendaFinal = texto.find((p) => p.includes("venda final"));
  assert.ok(vendaFinal);
  // Mesmo em venda final, os 7 dias continuam escritos como direito.
  assert.match(vendaFinal, new RegExp(`${PRAZO_LEGAL_DIAS} dias de arrependimento previstos em lei`));
  assert.ok(texto.some((p) => p.includes("2 hora(s)")));
});

test("texto do lojista substitui o modelo, e o modelo continua para o resto", () => {
  const t = loja({ politicas: { envio: { corpo: "Enviamos por motoboy.", atualizadoEm: "2026-09-17T00:00:00.000Z" } } });
  const envio = politicaPublicada(t, "envio");
  assert.equal(envio?.propria, true);
  assert.deepEqual(envio?.paragrafos, ["Enviamos por motoboy."]);

  const privacidade = politicaPublicada(t, "privacidade");
  assert.equal(privacidade?.propria, false);
  assert.ok(privacidade!.paragrafos.length > 1);
});

test("corpo em branco não conta como política escrita", () => {
  assert.deepEqual(lerPoliticasEscritas({ envio: { corpo: "   " } }), {});
  assert.deepEqual(lerPoliticasEscritas({ inexistente: { corpo: "oi" } }), {});
  assert.equal(politicaPublicada(loja({ politicas: { envio: { corpo: "" } } }), "envio")?.propria, false);
});

/**
 * Aviso legal é o único tipo sem modelo: depende do que a loja vende e ninguém
 * pode escrever no lugar dela. Loja que não escreveu não ganha link no rodapé.
 */
test("aviso legal em branco não é publicado", () => {
  assert.equal(politicaPublicada(loja(), "aviso-legal"), null);
  assert.equal(politicasPublicadas(loja()).some((p) => p.tipo === "aviso-legal"), false);

  const t = loja({ politicas: { "aviso-legal": { corpo: "Venda proibida para menores de 18 anos." } } });
  assert.equal(politicasPublicadas(t).some((p) => p.tipo === "aviso-legal"), true);
});

/** O que o lojista escreve é texto, nunca marcação executável na vitrine. */
test("parágrafos saem por linha em branco, sem interpretar marcação", () => {
  assert.deepEqual(emParagrafos("um\n\ndois"), ["um", "dois"]);
  assert.deepEqual(emParagrafos("um\nainda um\n\n\n dois "), ["um\nainda um", "dois"]);
  assert.deepEqual(emParagrafos("<script>alert(1)</script>"), ["<script>alert(1)</script>"]);
  assert.deepEqual(emParagrafos("\n\n  \n"), []);
});

test("CNPJ e razão social entram nos modelos quando a loja os tem", () => {
  const t = loja({ razaoSocial: "Teste Comércio Ltda", cnpj: "12345678000190" });
  assert.match(modeloDePolitica(t, "termos")[0], /Teste Comércio Ltda/);
  assert.match(modeloDePolitica(t, "privacidade")[0], /CNPJ/);
});
