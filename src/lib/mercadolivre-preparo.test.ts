import { strict as assert } from "node:assert";
import { afterEach, test } from "node:test";
import { atributosComCache, limparCache, prepararProduto, tamanhoDoCache } from "./mercadolivre-preparo";

/**
 * A barreira de qualidade, contra os produtos reais da Vedashow e da FX.
 *
 * As respostas do Mercado Livre usadas aqui foram capturadas da API pública em
 * 02/09/2026 e estão em `RESPOSTAS`. O teste é determinístico de propósito: ele
 * fixa o comportamento que já provamos contra a API viva, e não depende de a
 * rede estar de pé para rodar no build. A prova contra a API de verdade é
 * separada, em `scripts/provar-preparo-ml.ts`.
 */

type Sugestao = { category_id: string; category_name: string; domain_id: string; domain_name: string };

const AGUAS: Sugestao = {
  category_id: "MLB269718",
  category_name: "Águas Minerais",
  domain_id: "MLB-MINERAL_WATERS",
  domain_name: "Águas minerais",
};

/**
 * Respostas reais do `domain_discovery/search`, pelo começo do nome enriquecido.
 *
 * A chave é prefixo porque a marca entra no fim do nome ("... 6205 2RS FAG") e
 * não muda a categoria que o ML devolve: conferido contra a API em 02/09/2026.
 */
const RESPOSTAS: Record<string, Sugestao[]> = {
  "Retentor para veículos 49X65X10": [
    { category_id: "MLB375065", category_name: "Retentores", domain_id: "MLB-VEHICLE_OIL_SEALS", domain_name: "Retentores para veículos" },
    AGUAS,
  ],
  "Rolamento rígido de esferas 6205 2RS": [
    { category_id: "MLB455028", category_name: "Esferas de Rolamento", domain_id: "MLB-BEARING_BALLS", domain_name: "Esferas de rolamento" },
    AGUAS,
  ],
  "Correia de transmissão 5PK 1230": [
    { category_id: "MLB439169", category_name: "Correia de Transmissão", domain_id: "MLB-VEHICLE_TRANSMISSION_BELTS", domain_name: "Correias de transmissão para veículos" },
    AGUAS,
    { category_id: "MLB47111", category_name: "Correias Dentadas", domain_id: "MLB-VEHICLE_TIMING_BELTS", domain_name: "Correias dentadas para veículos" },
  ],
  "Eletrodo FX 13 3,25 mm": [
    { category_id: "MLB271856", category_name: "Eletrodos para Solda", domain_id: "MLB-WELDING_ELECTRODES", domain_name: "Eletrodos para solda" },
    AGUAS,
  ],
  // O caso perigoso: o ML responde com convicção uma categoria absurda.
  "Papelão Hidráulico 0,40": [
    { category_id: "MLB252555", category_name: "Papéis Higiênicos", domain_id: "MLB-TOILET_PAPERS", domain_name: "Papéis higiênicos" },
    AGUAS,
  ],
  // Nome de balcão que não diz nada: o coringa vem em primeiro.
  "00005 B": [AGUAS],
  // Coringa na frente e, depois dele, uma categoria que casa por palavra.
  "Fita Crepe Genérica": [
    AGUAS,
    { category_id: "MLB435308", category_name: "Fitas de Papel", domain_id: "MLB-PAPER_TAPES", domain_name: "Fitas de papel" },
  ],
};

/** Atributos reais das categorias usadas, com as tags como o ML devolve. */
const ATRIBUTOS: Record<string, Array<{ id: string; name: string; tags: Record<string, boolean> }>> = {
  MLB375065: [
    { id: "BRAND", name: "Marca", tags: { required: true, catalog_required: true } },
    { id: "PART_NUMBER", name: "Número de peça", tags: { required: true, catalog_required: true } },
    { id: "VEHICLE_TYPE", name: "Tipo de veículo", tags: { required: true } },
  ],
  MLB455028: [
    { id: "BRAND", name: "Marca", tags: { required: true, catalog_required: true } },
    { id: "MATERIAL", name: "Material", tags: { required: true, catalog_required: true } },
    { id: "GTIN", name: "Código universal de produto", tags: { conditional_required: true } },
  ],
  MLB439169: [{ id: "BRAND", name: "Marca", tags: { required: true, catalog_required: true } }],
  MLB271856: [
    { id: "BRAND", name: "Marca", tags: { required: true, catalog_required: true } },
    { id: "MODEL", name: "Modelo", tags: { required: true, catalog_required: true } },
    { id: "GTIN", name: "Código universal de produto", tags: { conditional_required: true } },
  ],
};

let chamadasCategoria = 0;
let chamadasAtributos = 0;

const original = globalThis.fetch;

globalThis.fetch = (async (entrada: RequestInfo | URL) => {
  const url = String(entrada);

  if (url.includes("domain_discovery/search")) {
    chamadasCategoria++;
    const q = decodeURIComponent(new URL(url).searchParams.get("q") ?? "");
    const chave = Object.keys(RESPOSTAS).find((k) => q.startsWith(k));
    return Response.json(chave ? RESPOSTAS[chave] : []);
  }

  const cat = url.match(/categories\/(MLB\d+)\/attributes/);
  if (cat) {
    chamadasAtributos++;
    return Response.json(ATRIBUTOS[cat[1]] ?? []);
  }

  return original(entrada as RequestInfo);
}) as typeof fetch;

/** Produto no formato mínimo que o preparo lê. */
function produto(p: Partial<Parameters<typeof prepararProduto>[0]["produto"]> & { nome: string }) {
  return {
    id: p.id ?? "p1",
    nome: p.nome,
    marca: p.marca ?? null,
    sku: p.sku ?? null,
    gtin: p.gtin ?? null,
    atributos: p.atributos ?? {},
  };
}

afterEach(() => {
  limparCache();
  chamadasCategoria = 0;
  chamadasAtributos = 0;
});

test("retentor da Vedashow cai em Retentores, não em água mineral", async () => {
  const r = await prepararProduto({
    produto: produto({ nome: "RET.49X65X10 BAG T.B", marca: "SAV", sku: "12345" }),
    grupo: "RETENTOR",
  });
  assert.equal(r.categoria?.categoriaId, "MLB375065");
  assert.equal(r.nomeEnriquecido, "Retentor para veículos 49X65X10 SAV");
});

test("a categoria coringa nunca é a resposta", async () => {
  const r = await prepararProduto({ produto: produto({ nome: "RET.49X65X10 BAG T.B" }), grupo: "RETENTOR" });
  assert.notEqual(r.categoria?.categoriaId, "MLB269718");
  assert.ok(!r.alternativas.some((a) => a.categoriaId === "MLB269718"));
});

test("categoria absurda é recusada: papelão hidráulico não é papel higiênico", async () => {
  const r = await prepararProduto({ produto: produto({ nome: "Papelão Hidráulico 0,40" }), grupo: "DIVERSOS" });
  assert.equal(r.confianca, "nenhuma");
  assert.equal(r.estado, "BLOQUEADO");
  assert.ok(r.motivos.some((m) => m.includes("não tem relação")));
});

test("produto bloqueado por categoria não lista pendência de atributo que não conferiu", async () => {
  // Listar "informe a marca" a partir de uma categoria errada mandaria o
  // lojista preencher campo de papel higiênico.
  const r = await prepararProduto({ produto: produto({ nome: "Papelão Hidráulico 0,40" }) });
  assert.deepEqual(r.faltando, []);
  assert.equal(chamadasAtributos, 0);
});

test("nome de balcão sem sentido não vira categoria", async () => {
  const r = await prepararProduto({ produto: produto({ nome: "00005 B" }) });
  assert.equal(r.categoria, null);
  assert.equal(r.confianca, "nenhuma");
  assert.equal(r.estado, "BLOQUEADO");
});

test("eletrodo da FX com marca e modelo é reconhecido com confiança alta", async () => {
  const r = await prepararProduto({
    produto: produto({ nome: "Eletrodo FX 13 3,25 mm", marca: "FX", atributos: { modelo: "FX 13" } }),
    grupo: "ELETRODO",
  });
  assert.equal(r.categoria?.categoriaId, "MLB271856");
  assert.equal(r.confianca, "alta");
  assert.deepEqual(r.faltando.filter((f) => f.exigencia !== "conditional_required"), []);
});

test("GTIN ausente não bloqueia: é condicional, então é revisão", async () => {
  const r = await prepararProduto({
    produto: produto({ nome: "Eletrodo FX 13 3,25 mm", marca: "FX", atributos: { modelo: "FX 13" } }),
    grupo: "ELETRODO",
  });
  const gtin = r.faltando.find((f) => f.id === "GTIN");
  assert.equal(gtin?.exigencia, "conditional_required");
  assert.equal(r.estado, "REVISAO");
  assert.ok(r.pendencias.some((p) => p.includes("aparece menos")));
});

test("com GTIN no cadastro, o eletrodo fica PRONTO", async () => {
  const r = await prepararProduto({
    produto: produto({
      nome: "Eletrodo FX 13 3,25 mm",
      marca: "FX",
      gtin: "7891234567895",
      atributos: { modelo: "FX 13" },
    }),
    grupo: "ELETRODO",
  });
  assert.equal(r.estado, "PRONTO");
  assert.deepEqual(r.pendencias, []);
  assert.ok(r.presentes.some((p) => p.id === "GTIN" && p.valor === "7891234567895"));
});

test("atributo obrigatório ausente bloqueia e diz o que fazer", async () => {
  const r = await prepararProduto({
    produto: produto({ nome: "ROL.6205 2RS", marca: "FAG" }),
    grupo: "ROLAMENTO",
  });
  assert.equal(r.categoria?.categoriaId, "MLB455028");
  assert.equal(r.estado, "BLOQUEADO");
  assert.ok(r.faltando.some((f) => f.id === "MATERIAL"));
  assert.ok(r.pendencias.some((p) => p.toLowerCase().includes("material")));
});

test("material informado pelo lojista destrava o rolamento", async () => {
  const r = await prepararProduto({
    produto: produto({ nome: "ROL.6205 2RS", marca: "FAG", atributos: { material: "Aço cromo" } }),
    grupo: "ROLAMENTO",
  });
  // Deixa de ser BLOQUEADO. Continua em revisão pelo GTIN, que é condicional.
  assert.equal(r.estado, "REVISAO");
  assert.deepEqual(r.faltando.filter((f) => f.exigencia !== "conditional_required"), []);
  assert.ok(r.presentes.some((p) => p.id === "MATERIAL" && p.valor === "Aço cromo"));
});

test("marca e GTIN são marcados como não inferíveis", async () => {
  const r = await prepararProduto({ produto: produto({ nome: "ROL.6205 2RS" }), grupo: "ROLAMENTO" });
  const ids = r.naoInferiveis.map((n) => n.id);
  assert.ok(ids.includes("BRAND"));
  assert.ok(ids.includes("MATERIAL"));
  assert.ok(r.naoInferiveis.every((n) => n.naoInferivel === true));
});

test('marca "DIVERSOS" conta como ausência de marca', async () => {
  const r = await prepararProduto({
    produto: produto({ nome: "ROL.6205 2RS", marca: "DIVERSOS", atributos: { material: "Aço" } }),
    grupo: "ROLAMENTO",
  });
  assert.ok(r.faltando.some((f) => f.id === "BRAND"));
  assert.equal(r.estado, "BLOQUEADO");
});

test("o preparo diz de onde veio cada valor", async () => {
  const r = await prepararProduto({
    produto: produto({ nome: "RET.49X65X10", marca: "SAV", sku: "SV-4965" }),
    grupo: "RETENTOR",
  });
  const marca = r.presentes.find((p) => p.id === "BRAND");
  const peca = r.presentes.find((p) => p.id === "PART_NUMBER");
  assert.equal(marca?.origem, "marca do produto");
  assert.match(peca?.origem ?? "", /SKU/);
});

test("nada é inventado: sem tipo de veículo, o retentor não passa", async () => {
  const r = await prepararProduto({
    produto: produto({ nome: "RET.49X65X10", marca: "SAV", sku: "SV-4965" }),
    grupo: "RETENTOR",
  });
  assert.ok(r.faltando.some((f) => f.id === "VEHICLE_TYPE"));
  assert.equal(r.estado, "BLOQUEADO");
  assert.ok(r.presentes.every((p) => p.valor && p.valor.trim().length > 0));
});

test("correia ambígua vira revisão, não publicação silenciosa", async () => {
  // Transmissão e dentada são categorias diferentes e o ML oferece as duas.
  // Escolher sozinho manda correia errada para o comprador.
  const r = await prepararProduto({
    produto: produto({ nome: "5PK 1230", marca: "Gates" }),
    grupo: "CORREIA",
  });
  assert.equal(r.categoria?.categoriaId, "MLB439169");
  assert.ok(r.alternativas.some((a) => a.categoriaId === "MLB47111"));
  assert.equal(r.confianca, "media");
  assert.equal(r.estado, "REVISAO");
  assert.ok(r.motivos.some((m) => m.includes("parecida")));
});

test("a confiança vem sempre com motivo escrito", async () => {
  const r = await prepararProduto({ produto: produto({ nome: "RET.49X65X10", marca: "SAV" }), grupo: "RETENTOR" });
  assert.ok(r.motivos.length > 0);
  assert.ok(r.motivos.every((m) => m.length > 10));
});

test("cache: 800 retentores fazem uma chamada de atributos, não 800", async () => {
  for (let i = 0; i < 800; i++) {
    await prepararProduto({
      produto: produto({ id: `p${i}`, nome: "RET.49X65X10", marca: "SAV", sku: `SV-${i}` }),
      grupo: "RETENTOR",
    });
  }
  assert.equal(chamadasAtributos, 1);
  assert.equal(tamanhoDoCache(), 1);
  // A previsão de categoria não é cacheada: cada nome é diferente na vida real.
  assert.equal(chamadasCategoria, 800);
});

test("cache: categorias diferentes não se misturam", async () => {
  await atributosComCache("MLB375065");
  await atributosComCache("MLB455028");
  await atributosComCache("MLB375065");
  assert.equal(chamadasAtributos, 2);
  assert.equal(tamanhoDoCache(), 2);
});

test("cache: pedidos simultâneos da mesma categoria fazem uma chamada só", async () => {
  await Promise.all([atributosComCache("MLB375065"), atributosComCache("MLB375065"), atributosComCache("MLB375065")]);
  assert.equal(chamadasAtributos, 1);
});

test("coringa em primeiro lugar invalida a lista inteira", async () => {
  // Achado na prova contra a API viva em 02/09/2026: o ML passou a devolver
  // "Fitas de Papel" para "Papelão hidráulico", que casa por radical com
  // "papelão". Se o coringa vier na frente, o que vem depois é resto de lista e
  // não pode virar confiança, por mais que as palavras se pareçam.
  const r = await prepararProduto({ produto: produto({ nome: "Fita crepe genérica" }) });
  assert.equal(r.confianca, "nenhuma");
  assert.equal(r.estado, "BLOQUEADO");
  assert.ok(r.motivos.some((m) => m.includes("não reconheceu")));
  // E não afirma duas coisas contrárias na mesma lista.
  assert.ok(!r.motivos.some((m) => m.includes("falam da mesma coisa")));
});

test("não cobra motivo de GTIN vazio de quem tem GTIN", async () => {
  const r = await prepararProduto({
    produto: produto({
      nome: "Eletrodo FX 13 3,25 mm",
      marca: "FX",
      gtin: "7891234567895",
      atributos: { modelo: "FX 13" },
    }),
    grupo: "ELETRODO",
  });
  assert.ok(!r.pendencias.some((p) => p.toLowerCase().includes("gtin vazio")));
});

test("o nome original é preservado, para o lojista comparar", async () => {
  const r = await prepararProduto({ produto: produto({ nome: "RET.49X65X10 BAG T.B" }), grupo: "RETENTOR" });
  assert.equal(r.nomeOriginal, "RET.49X65X10 BAG T.B");
  assert.notEqual(r.nomeEnriquecido, r.nomeOriginal);
  assert.ok(r.aplicou.length > 0);
});
