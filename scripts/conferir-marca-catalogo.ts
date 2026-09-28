/**
 * Confere a marca declarada no catálogo de uma loja e aplica correção revisada.
 *
 *   npx tsx scripts/conferir-marca-catalogo.ts brilhax
 *   npx tsx scripts/conferir-marca-catalogo.ts brilhax --corrigir darker-500ml=Vintex --aplicar
 *   npx tsx scripts/conferir-marca-catalogo.ts brilhax --corrigir aplicador-esp=  --aplicar
 *
 * Sem `--aplicar` nada é escrito: o script só relata. Sai com código 1 quando
 * sobra divergência, então serve de porta depois de importação e de migração.
 *
 * A regra mora em `src/lib/marca-catalogo.ts` e é testada por
 * `npm run test` — aqui só se lê o catálogo e se escreve o que foi revisado.
 *
 * `--corrigir <slug>=<Marca>` existe porque a prova que falta não está no
 * banco: é a embalagem na foto do produto. Quem roda o comando é quem olhou a
 * foto, e a correção entra pelo caminho normal do catálogo, com `origem`
 * própria, então fica registrada em `HistoricoCatalogo` com antes e depois.
 * Valor vazio (`<slug>=`) apaga a marca — a vitrine e o feed omitem `brand`
 * quando ela é nula, que é o certo para produto cuja marca ninguém provou.
 *
 * Este script não adivinha marca. Produto em `sem evidência` sai na lista
 * para conferência humana e continua como está.
 */
import { prisma } from "../src/lib/db";
import { salvarProdutoNoCatalogo } from "../src/lib/catalogo-escrita";
import { conferirCatalogo } from "../src/lib/marca-catalogo";

const argumentos = process.argv.slice(2);
const slug = argumentos.find((a) => !a.startsWith("--"));
const aplicar = argumentos.includes("--aplicar");

if (!slug) {
  console.error("uso: npx tsx scripts/conferir-marca-catalogo.ts <slug-da-loja> [--corrigir <slug-produto>=<Marca>] [--aplicar]");
  process.exit(2);
}

/** `--corrigir slug=Marca`, repetível. Marca vazia apaga o campo. */
const correcoes = new Map<string, string | null>();
for (let i = 0; i < argumentos.length; i++) {
  if (argumentos[i] !== "--corrigir") continue;
  const par = argumentos[i + 1] ?? "";
  const corte = par.indexOf("=");
  if (corte < 1) {
    console.error(`--corrigir espera <slug-produto>=<Marca>, recebeu ${JSON.stringify(par)}`);
    process.exit(2);
  }
  const valor = par.slice(corte + 1).trim();
  correcoes.set(par.slice(0, corte).trim(), valor === "" ? null : valor);
}

async function main() {
  const loja = await prisma.tenant.findUnique({ where: { slug }, select: { id: true, nome: true } });
  if (!loja) {
    console.error(`Loja ${slug} não existe.`);
    process.exit(2);
  }

  const produtos = await prisma.produto.findMany({
    where: { tenantId: loja.id },
    select: { id: true, slug: true, nome: true, marca: true },
    orderBy: { nome: "asc" },
  });

  const r = conferirCatalogo(produtos);
  console.log(`${loja.nome} · ${produtos.length} produtos`);
  console.log(`marcas cadastradas: ${r.vocabulario.join(", ") || "(nenhuma)"}\n`);
  console.log(`  confirmadas pelo nome : ${r.confirmadas.length}`);
  console.log(`  sem marca declarada   : ${r.semMarca.length}`);
  console.log(`  sem evidência no nome : ${r.semEvidencia.length}`);
  console.log(`  DIVERGENTES           : ${r.divergentes.length}\n`);

  for (const l of r.divergentes) {
    console.log(`  divergente  ${l.slug}: declarada ${JSON.stringify(l.marca)}, o nome diz ${JSON.stringify(l.marcaCitada)} — ${l.nome}`);
  }
  if (r.divergentes.length) console.log("");

  if (r.semEvidencia.length) {
    console.log("Sem evidência no cadastro — confira a embalagem na foto antes de declarar marca:");
    for (const l of r.semEvidencia) console.log(`  ${l.slug}: ${JSON.stringify(l.marca)} — ${l.nome}`);
    console.log("");
  }

  const porSlug = new Map(produtos.map((p) => [p.slug, p]));
  const pendentes: { slug: string; de: string | null; para: string | null; id: string }[] = [];
  for (const [slugProduto, marca] of correcoes) {
    const p = porSlug.get(slugProduto);
    if (!p) {
      console.error(`--corrigir ${slugProduto}: produto não existe nesta loja.`);
      process.exit(2);
    }
    if ((p.marca ?? null) === marca) continue; // já está assim: nada a fazer
    pendentes.push({ slug: slugProduto, de: p.marca, para: marca, id: p.id });
  }

  if (pendentes.length) {
    console.log(aplicar ? "Aplicando correção revisada:" : "Correção revisada (use --aplicar para gravar):");
    for (const c of pendentes) console.log(`  ${c.slug}: ${JSON.stringify(c.de)} -> ${JSON.stringify(c.para)}`);
    if (aplicar) {
      for (const c of pendentes) {
        await salvarProdutoNoCatalogo(loja.id, c.id, { marca: c.para }, { origem: "conferencia-marca" });
      }
      console.log(`  ${pendentes.length} produto(s) gravado(s), com histórico.`);
    }
    console.log("");
  } else if (correcoes.size) {
    console.log("Correção revisada: o catálogo já está assim, nada a gravar.\n");
  }

  // A divergência que a correção acabou de resolver não deve reprovar a rodada.
  const aindaDivergentes = r.divergentes.filter((l) => !(aplicar && correcoes.has(l.slug)));
  if (aindaDivergentes.length) {
    console.error(`${aindaDivergentes.length} divergência(s) de marca em aberto.`);
    process.exitCode = 1;
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
