import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { LAYOUTS, VALORES_LAYOUT, TemaSchema, lerTema, mesclarTema } from "./tema";
import { MCP_TOOLS } from "./mcp-tools";

/**
 * A lista de layouts existia em quatro lugares com quatro respostas (17/09/2026):
 * dez no schema, "sete" na landing, "oito" num comentário e sete na descrição
 * do MCP — cujo enum, com nove, deixava o Automotivo Premium inalcançável por
 * um agente. Aqui o schema é a fonte, e quem divergir dele falha.
 */

/** Layouts que a landing não ilustra, e o motivo. Some da lista, entra na vitrine. */
const FORA_DA_LANDING: Record<string, string> = {
  "automotivo-premium": "é a loja inteira, não uma home; miniatura de home não o representa",
  farmacia: "ainda sem composição própria: a home abre por busca e por atalhos que saem do catálogo da loja, e uma miniatura genérica inventaria uma drogaria",
};

const fonte = (caminho: string) => readFileSync(caminho, "utf8");

test("a ferramenta do MCP oferece exatamente os layouts que existem", () => {
  const marca = MCP_TOOLS.find((t) => t.name === "atualizar_marca")!;
  const layout = (marca.inputSchema.properties.layout as { enum: string[] }).enum;
  assert.deepEqual([...layout].sort(), [...VALORES_LAYOUT].sort());
  for (const valor of VALORES_LAYOUT) assert.ok(marca.description.includes(valor), `a descrição não cita ${valor}`);
});

test("a landing ilustra todo layout que não estiver declarado fora", () => {
  const showcase = fonte("src/components/plataforma/ModelosInterativos.tsx");
  const ilustrados = [...showcase.matchAll(/\{ id: "([a-z-]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...ilustrados, ...Object.keys(FORA_DA_LANDING)].sort(), [...VALORES_LAYOUT].sort());
});

test("o número escrito na landing é o número de composições ilustradas", () => {
  const showcase = fonte("src/components/plataforma/ModelosInterativos.tsx");
  const quantos = [...showcase.matchAll(/\{ id: "([a-z-]+)"/g)].length;
  const escrito = fonte("src/app/plataforma/(site)/page.tsx").match(/pl-kicker">(\w+) jeitos de mostrar a vitrine/)?.[1];
  const POR_EXTENSO = ["zero","Um","Dois","Três","Quatro","Cinco","Seis","Sete","Oito","Nove","Dez","Onze","Doze"];
  assert.equal(escrito, POR_EXTENSO[quantos], `a landing promete ${escrito} e a página mostra ${quantos}`);
});

test("cada layout tem rótulo e descrição para o painel", () => {
  for (const l of LAYOUTS) {
    assert.ok(l.rotulo.length > 0 && l.descricao.length > 10, l.valor);
  }
  assert.equal(new Set(VALORES_LAYOUT).size, VALORES_LAYOUT.length, "valor repetido em LAYOUTS");
});

test("tema inválido é recusado antes de gravar, não na leitura seguinte", () => {
  const atual = TemaSchema.parse({ corPrimaria: "#c62828", fonte: "poppins", layout: "vitrine" });
  assert.equal(mesclarTema(atual, { layout: "premium-de-luxo" as never }), null);
  assert.equal(mesclarTema(atual, { corPrimaria: "vermelho" as never }), null);
  assert.equal(mesclarTema(atual, { layout: "automotivo-premium" })?.layout, "automotivo-premium");
  // O que a validação evita: gravado assim, a loja perderia a identidade toda.
  assert.equal(lerTema({ ...atual, layout: "premium-de-luxo" }).corPrimaria, "#2563eb");
  assert.equal(mesclarTema(atual, { modo: "escuro" })?.corPrimaria, "#c62828");
});
