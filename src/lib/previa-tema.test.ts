import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import type { Tenant } from "@prisma/client";
import { TemaSchema, VALORES_LAYOUT } from "./tema";
import { COLUNAS, colunasVisiveis, linhaTecnica } from "./catalogo-tecnico";
import { etapasDoPremium } from "./etapas-premium";
import { LIMITE_RASCUNHO, catalogoDeDemonstracao, codificarRascunho, examinarRascunho, lerRascunho, lojaDaPrevia } from "./previa-tema";

/**
 * A prévia do painel promete duas coisas: mostrar o rascunho que o lojista
 * montou (e não outro tema) e não gravar nada. Estes testes prendem as duas.
 */

const fixture = JSON.parse(readFileSync("tests/fixtures/tema-premium-completo.json", "utf8"));
const base64url = (texto: string) => Buffer.from(texto, "utf8").toString("base64url");

test("o rascunho vai e volta pela URL sem perder nada", () => {
  const tema = TemaSchema.parse(fixture);
  const codificado = codificarRascunho(tema);
  assert.match(codificado, /^[A-Za-z0-9_-]+$/, "o texto tem de caber em ?t= sem escapar");
  assert.ok(codificado.length < LIMITE_RASCUNHO, "o tema premium completo tem de caber no limite");
  assert.deepEqual(lerRascunho(codificado), tema);
  // Acento e travessão do texto do lojista sobrevivem ao base64.
  const comAcento = TemaSchema.parse({ heroTitulo: "Peças — atenção à aplicação" });
  assert.deepEqual(lerRascunho(codificarRascunho(comAcento)), comAcento);
});

test("rascunho que não valida não desenha nada, nem o tema padrão", () => {
  assert.equal(lerRascunho(undefined), null, "ausente");
  assert.equal(lerRascunho(""), null, "vazio");
  assert.equal(lerRascunho("não é base64!"), null, "base64 inválido");
  assert.equal(lerRascunho(base64url("{isto não é json")), null, "JSON inválido");
  assert.equal(lerRascunho(base64url(JSON.stringify({ heroTitulo: "x" })).padEnd(LIMITE_RASCUNHO + 1, "A")), null, "acima do limite");
  assert.equal(lerRascunho(base64url(JSON.stringify({ ...fixture, layout: "premium-de-luxo" }))), null, "layout inexistente");
  assert.equal(lerRascunho(base64url(JSON.stringify({ ...fixture, corPrimaria: "red;}body{display:none" }))), null, "cor que injetaria CSS");
  assert.equal(lerRascunho(base64url("null")), null, "JSON que não é objeto");
});

test("rascunho inválido diz qual campo falhou, com o nome do formulário", () => {
  const campos = (tema: unknown) => {
    const r = examinarRascunho(base64url(JSON.stringify(tema)));
    assert.equal(r.tema, null);
    return r.tema === null ? r.campos : [];
  };
  const campanha = { imagemUrl: "/uploads/a.jpg", link: "/c/lavagem", alt: "Promoção de lavagem" };
  assert.deepEqual(campos({ campanhasHome: [campanha, { ...campanha, alt: "x" }] }), ["Arte 2: Descrição acessível da imagem"]);
  assert.deepEqual(campos({ corPrimaria: "vermelho", layout: "premium-de-luxo" }), ["Cor principal", "Template da loja"]);
  assert.deepEqual(campos({ premium: { heroTitulo: "x".repeat(121), etapas: [{ categoria: "Lavagem!", titulo: "t", texto: "t", icone: "lavagem" }] } }), ["Título do banner", "Etapa 1: Categoria"]);
  // Dois erros no mesmo campo aparecem uma vez; a lista tem teto.
  assert.deepEqual(campos({ campanhasHome: [{ ...campanha, link: "x".repeat(301) }] }), ["Arte 1: Destino do banner"]);
  assert.equal(campos({ campanhasHome: Array.from({ length: 5 }, () => ({ imagemUrl: "x", link: "x", alt: "" })) }).length, 5);
  // Endereço que nem é tema não tem campo para apontar.
  for (const texto of [undefined, "", "não é base64!", base64url("{isto não é json"), base64url("null")]) {
    assert.deepEqual(examinarRascunho(texto), { tema: null, campos: [] });
  }
  // O que valida devolve o mesmo tema que lerRascunho.
  const bom = codificarRascunho(TemaSchema.parse(fixture));
  assert.deepEqual(examinarRascunho(bom), { tema: lerRascunho(bom) });
});

test("a loja da prévia é cópia: a loja logada não muda", () => {
  const temaSalvo = { layout: "classico", corPrimaria: "#c62828" };
  const loja = { id: "loja-1", slug: "exemplo", nome: "Loja Exemplo", tema: temaSalvo } as unknown as Tenant;
  const retrato = JSON.stringify(loja);
  const rascunho = TemaSchema.parse(fixture);
  const previa = lojaDaPrevia(loja, rascunho);
  assert.notEqual(previa, loja);
  assert.deepEqual(previa.tema, rascunho);
  assert.equal(previa.nome, "Loja Exemplo");
  assert.equal(loja.tema, temaSalvo);
  assert.equal(JSON.stringify(loja), retrato);
});

test("o catálogo de demonstração serve a todos os layouts", () => {
  for (const layout of VALORES_LAYOUT) {
    const { categorias, vitrine } = catalogoDeDemonstracao();
    assert.ok(categorias.length >= 6, `${layout}: categorias`);
    assert.ok(vitrine.length >= 12, `${layout}: produtos`);
    for (const slug of ["lavagem", "polimento", "vitrificacao"]) assert.ok(categorias.some((c) => c.slug === slug), `${layout}: falta ${slug}`);
    for (const c of categorias) assert.ok(c.id.startsWith("demo-") && c.tenantId.startsWith("demo-"), c.slug);
    for (const p of vitrine) {
      assert.ok(p.id.startsWith("demo-") && p.tenantId.startsWith("demo-"), p.slug);
      assert.equal(p.ativo, true, p.slug);
      assert.ok(Number.isInteger(p.precoCentavos) && p.precoCentavos > 0, `${p.slug}: preço em centavos`);
      assert.ok(categorias.some((c) => c.id === p.categoriaId), `${p.slug}: categoria fora do catálogo`);
    }
    assert.equal(new Set(vitrine.map((p) => p.slug)).size, vitrine.length, "slug repetido");
    const tecnicos = vitrine.filter((p) => p.sku && p.codigoOriginal && p.codigosEquivalentes.length > 0 && linhaTecnica(p).aplicacao.total > 0 && linhaTecnica(p).medidas);
    assert.ok(tecnicos.length >= 4, `${layout}: peças com ficha técnica completa`);
    assert.deepEqual(colunasVisiveis(vitrine.map(linhaTecnica)), [...COLUNAS]);
    assert.equal(etapasDoPremium(TemaSchema.parse(fixture).premium, categorias).length, 3);
  }
  // Fixo e determinístico: duas chamadas, mesmo conteúdo, objetos diferentes.
  assert.deepEqual(catalogoDeDemonstracao(), catalogoDeDemonstracao());
  assert.notEqual(catalogoDeDemonstracao().vitrine, catalogoDeDemonstracao().vitrine);
});

const ROTA = "src/app/plataforma/(previa)";
const arquivosDaRota = (readdirSync(ROTA, { recursive: true }) as string[]).filter((a) => /\.tsx?$/.test(a)).map((a) => `${ROTA}/${a.replaceAll("\\", "/")}`);
const fonte = (caminho: string) => readFileSync(caminho, "utf8");

test("a prévia não grava, não mede e não avisa ninguém", () => {
  assert.ok(arquivosDaRota.some((a) => a.endsWith("painel/previa/page.tsx")), "a página da prévia saiu do lugar");
  const PROIBIDO = [
    /prisma\s*\.\s*\w+\s*\.\s*(create|update|upsert|delete)/,
    /\$(executeRaw|queryRaw|transaction)/,
    /atualizarTenant/,
    /emitir\(/,
    /fetch\(/,
    /"use server"/,
    /\b(Pixels|MedirSessao|Consentimento|WhatsAppFlutuante)\b/,
    /ld\+json/,
  ];
  for (const arquivo of [...arquivosDaRota, "src/lib/previa-tema.ts"]) {
    const texto = fonte(arquivo);
    for (const padrao of PROIBIDO) assert.doesNotMatch(texto, padrao, `${arquivo} não pode conter ${padrao}`);
  }
  const biblioteca = fonte("src/lib/previa-tema.ts");
  assert.doesNotMatch(biblioteca, /from "\.\/db"|@\/lib\/db|next\/headers/, "a biblioteca é pura");
  assert.doesNotMatch(biblioteca, /import (?!type)[^;]*@prisma\/client/, "de @prisma/client, só tipo");
  // A única leitura de banco é a da sessão.
  for (const arquivo of arquivosDaRota) assert.doesNotMatch(fonte(arquivo), /@\/lib\/db|@\/lib\/catalogo"/, `${arquivo} não consulta o banco`);
});

test("a prévia fica fora do chrome do painel e exige sessão", () => {
  assert.ok(arquivosDaRota.every((a) => !a.includes("(admin)")));
  const pagina = fonte(`${ROTA}/painel/previa/page.tsx`);
  assert.match(pagina, /lojistaAtual\(\)/);
  assert.match(pagina, /redirect\("\/entrar"\)/);
  assert.match(pagina, /robots: \{ index: false, follow: false \}/);
  assert.match(pagina, /<div inert /);
  assert.match(pagina, /slug=\{`previa-\$\{loja\.slug\}`\}/, "carrinho próprio, para não tocar no do lojista");
  assert.doesNotMatch(pagina, /lerTema|temaDo/, "a prévia desenha o rascunho, nunca o tema salvo ou o padrão");
  assert.doesNotMatch(pagina, /from "next\/link"|<Link\b/, "sair da prévia recarrega a página, para o <html> não levar o tema ao painel");
  // O script da prévia mexe no <html> antes da hidratação; o ramo da plataforma no layout raiz precisa aceitar.
  const raiz = readFileSync("src/app/layout.tsx", "utf8");
  assert.match(raiz, /x-plataforma[\s\S]{0,400}<html lang="pt-BR" suppressHydrationWarning>/);
});

test("a loja publicada e a prévia montam a home pelo mesmo mapa", () => {
  const importa = /import \{ comporHome \} from "@\/components\/home\/composicao"/;
  assert.match(fonte("src/app/page.tsx"), importa);
  assert.match(fonte(`${ROTA}/painel/previa/page.tsx`), importa);
  const composicao = fonte("src/components/home/composicao.tsx");
  for (const layout of VALORES_LAYOUT) assert.match(composicao, new RegExp(`^  "?${layout}"?: `, "m"), `composicao.tsx não tem ${layout}`);
});
