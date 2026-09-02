/**
 * Prova a preparação contra a API pública do Mercado Livre, sem conta conectada.
 *
 * Os testes de `mercadolivre-preparo.test.ts` são determinísticos e usam
 * respostas capturadas. Este script faz o contrário: bate na API de verdade,
 * com produtos reais da Vedashow e da FX Eletrodos, e mostra o veredito de cada
 * um. É o que se roda quando se desconfia que o ML mudou o preditor.
 *
 *   npx tsx scripts/provar-preparo-ml.ts
 */
import type { Prisma } from "@prisma/client";
import { prepararProduto, tamanhoDoCache } from "../src/lib/mercadolivre-preparo";

type Caso = {
  nome: string;
  grupo?: string;
  marca?: string;
  sku?: string;
  gtin?: string;
  atributos?: Record<string, unknown>;
  /** O que se espera provar com este caso. */
  espera: string;
};

const CASOS: Caso[] = [
  // Vedashow: nome de balcão, o pior caso e o mais comum.
  { nome: "RET.49X65X10 BAG T.B", grupo: "RETENTOR", marca: "SAV", sku: "V-4965", espera: "categoria de retentor, não água mineral" },
  { nome: "RET.85X140X12 BRG 38637", grupo: "RETENTOR", marca: "BRG", sku: "V-8514", espera: "categoria de retentor" },
  { nome: "ROL.6205 2RS", grupo: "ROLAMENTO", marca: "FAG", sku: "V-6205", espera: "esferas de rolamento; material faltando bloqueia" },
  { nome: "5PK 1230", grupo: "CORREIA", marca: "Gates", sku: "V-5PK", espera: "correia; duas categorias plausíveis = revisão" },
  // FX Eletrodos: nome já bom.
  { nome: "Eletrodo FX 13 3,25 mm", grupo: "ELETRODO", marca: "FX", atributos: { modelo: "FX 13" }, espera: "eletrodos para solda, pronto ou revisão por GTIN" },
  // Ambíguo de propósito: o ML responde com convicção uma categoria absurda.
  { nome: "Papelão Hidráulico 0,40", grupo: "DIVERSOS", espera: "BLOQUEADO: papel higiênico não é papelão hidráulico" },
  // Nome que não diz nada.
  { nome: "00005 B", espera: "BLOQUEADO: não dá para adivinhar" },
];

const CORES = { PRONTO: "\x1b[32m", REVISAO: "\x1b[33m", BLOQUEADO: "\x1b[31m" } as const;

async function main() {
  let chamadas = 0;
  const original = globalThis.fetch;
  globalThis.fetch = ((e: RequestInfo | URL, i?: RequestInit) => {
    chamadas++;
    return original(e, i);
  }) as typeof fetch;

  const contagem = { PRONTO: 0, REVISAO: 0, BLOQUEADO: 0 };

  for (const c of CASOS) {
    const r = await prepararProduto({
      produto: {
        id: c.sku ?? c.nome,
        nome: c.nome,
        marca: c.marca ?? null,
        sku: c.sku ?? null,
        gtin: c.gtin ?? null,
        atributos: (c.atributos ?? {}) as Prisma.JsonValue,
      },
      grupo: c.grupo,
    });
    contagem[r.estado]++;

    console.log(`\n${CORES[r.estado]}${r.estado}\x1b[0m  ${c.nome}`);
    console.log(`  espera-se: ${c.espera}`);
    console.log(`  nome:      ${r.nomeEnriquecido}`);
    console.log(`  categoria: ${r.categoria ? `${r.categoria.categoriaId} ${r.categoria.categoriaNome}` : "(nenhuma)"} · confiança ${r.confianca}`);
    if (r.alternativas.length) {
      console.log(`  outras:    ${r.alternativas.map((a) => `${a.categoriaId} ${a.categoriaNome}`).join(" | ")}`);
    }
    for (const m of r.motivos) console.log(`   · ${m}`);
    if (r.presentes.length) console.log(`  tem:       ${r.presentes.map((p) => `${p.id}=${p.valor}`).join(", ")}`);
    if (r.faltando.length) console.log(`  falta:     ${r.faltando.map((f) => `${f.id}${f.naoInferivel ? " (não inferível)" : ""}`).join(", ")}`);
    for (const p of r.pendencias) console.log(`   ! ${p}`);
  }

  console.log(
    `\n${contagem.PRONTO} pronto, ${contagem.REVISAO} em revisão, ${contagem.BLOQUEADO} bloqueado.` +
      ` ${chamadas} chamadas à API para ${CASOS.length} produtos, ${tamanhoDoCache()} categoria(s) em cache.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
