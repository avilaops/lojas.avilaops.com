/**
 * Reconcilia o catálogo da Brilhax produto a produto.
 *
 * Cruza quatro fontes: o Medusa (origem), a plataforma (destino), o feed do
 * Merchant (o que vai ao Google) e o sitemap da loja antiga (o que o Google
 * pode ter indexado).
 *
 * Existe porque os números soltos dos relatórios anteriores não se explicavam,
 * e um deles estava errado: "145 produtos vieram sem preço" era 224 − 79, não
 * uma consulta. O número real é 142 sem preço mais 3 que têm preço e estão
 * inativos por outro motivo.
 */
import { readFileSync, writeFileSync } from "node:fs";

const D = "C:/Users/nicol/AppData/Local/Temp/claude/d--avilaops-com/4214cdf1-5234-4aee-8915-a1ca9d6ae965/scratchpad";
const NOVA = "https://brilhax.lojas.avilaops.com";
const ANTIGA = "https://brilhax.com";

const produtos = JSON.parse(readFileSync(`${D}/cat-novo.json`, "utf8"));

// O que está no feed hoje, por id (o feed usa o id do produto como g:id).
const feedXml = await fetch(`${NOVA}/feed/merchant.xml`, { signal: AbortSignal.timeout(60000) }).then((r) => r.text());
const noFeed = new Set([...feedXml.matchAll(/<g:id>([^<:]+)/g)].map((m) => m[1]));

// O que a loja antiga publicava no sitemap. Presença aqui NÃO é prova de
// indexação: é só o que foi oferecido ao Google.
const smXml = await fetch(`${ANTIGA}/sitemap.xml`, { signal: AbortSignal.timeout(60000) }).then((r) => r.text());
const noSitemapAntigo = new Set(
  [...smXml.matchAll(/<loc>https:\/\/brilhax\.com\/produtos\/([^/<]+)\/<\/loc>/g)].map((m) => m[1]),
);

const linhas = produtos.map((p) => {
  const temPreco = Boolean(p.precoCentavos);
  const temImagem = Boolean(p.imagens?.length);
  const noFeedAgora = noFeed.has(p.id);

  let motivoForaDoFeed = "";
  if (!noFeedAgora) {
    if (!p.ativo) motivoForaDoFeed = "inativo";
    else if (!temImagem) motivoForaDoFeed = "sem imagem (obrigatoria no Merchant)";
    else if (!temPreco) motivoForaDoFeed = "sem preco";
    else motivoForaDoFeed = "?? investigar";
  }

  let motivoInativo = "";
  if (!p.ativo) {
    motivoInativo = temPreco
      ? "rascunho no Medusa (tem preco)"
      : "sem preco cadastrado";
  }

  return {
    slug: p.slug,
    sku: p.sku ?? "",
    gtin: p.gtin ?? "",
    categoria: p.categoria?.slug ?? "",
    statusOrigemMedusa: noSitemapAntigo.has(p.slug) ? "published" : "draft/ausente",
    statusAtual: p.ativo ? "ativo" : "inativo",
    motivoInativo,
    precoCentavos: p.precoCentavos ?? 0,
    precoValido: temPreco,
    estoque: p.estoque ?? null,
    disponibilidade: p.disponibilidade ?? "",
    imagens: p.imagens?.length ?? 0,
    imagemUtilizavel: temImagem,
    noFeed: noFeedAgora,
    motivoForaDoFeed,
    noSitemapAntigo: noSitemapAntigo.has(p.slug),
    indexadoNoGoogle: "nao verificado",
  };
});

// --- conferências que os relatórios anteriores não fizeram ----------------
const n = (f) => linhas.filter(f).length;
console.log(`total .................... ${linhas.length}`);
console.log(`ativos ................... ${n((l) => l.statusAtual === "ativo")}`);
console.log(`  com imagem ............. ${n((l) => l.statusAtual === "ativo" && l.imagemUtilizavel)}`);
console.log(`  SEM imagem ............. ${n((l) => l.statusAtual === "ativo" && !l.imagemUtilizavel)}`);
console.log(`inativos ................. ${n((l) => l.statusAtual === "inativo")}`);
console.log(`  por falta de preco ..... ${n((l) => l.motivoInativo === "sem preco cadastrado")}`);
console.log(`  rascunho COM preco ..... ${n((l) => l.motivoInativo === "rascunho no Medusa (tem preco)")}`);
console.log(`no feed .................. ${n((l) => l.noFeed)}`);
console.log(`fora do feed ............. ${n((l) => !l.noFeed)}`);
for (const m of [...new Set(linhas.filter((l) => !l.noFeed).map((l) => l.motivoForaDoFeed))]) {
  console.log(`  ${m}: ${n((l) => l.motivoForaDoFeed === m)}`);
}
console.log(`no sitemap antigo ........ ${n((l) => l.noSitemapAntigo)}`);
console.log(`  e hoje inativo ......... ${n((l) => l.noSitemapAntigo && l.statusAtual === "inativo")}`);
console.log(`  e hoje ativo ........... ${n((l) => l.noSitemapAntigo && l.statusAtual === "ativo")}`);
console.log(`indexacao no Google ...... nao verificado (sem acesso ao Search Console de brilhax.com)`);

// --- soma bate? -----------------------------------------------------------
const ativos = n((l) => l.statusAtual === "ativo");
const comImg = n((l) => l.statusAtual === "ativo" && l.imagemUtilizavel);
const semImg = n((l) => l.statusAtual === "ativo" && !l.imagemUtilizavel);
console.log(`\nconferencia: ativos ${ativos} = com imagem ${comImg} + sem imagem ${semImg} -> ${comImg + semImg === ativos ? "OK" : "DIVERGE"}`);
console.log(`conferencia: no feed ${n((l) => l.noFeed)} = ativos com imagem ${comImg} -> ${n((l) => l.noFeed) === comImg ? "OK" : "DIVERGE"}`);

const cab = Object.keys(linhas[0]);
writeFileSync(
  `${D}/catalogo-reconciliado.csv`,
  "\ufeff" + [cab.join(";"), ...linhas.map((l) => cab.map((c) => String(l[c] ?? "")).join(";"))].join("\r\n"),
  "utf8",
);
writeFileSync(`${D}/catalogo-reconciliado.json`, JSON.stringify(linhas, null, 1), "utf8");
console.log(`\nsalvo: catalogo-reconciliado.csv (${linhas.length} linhas)`);
