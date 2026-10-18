import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "../src/lib/db";
import { salvarProdutoNoCatalogo } from "../src/lib/catalogo-escrita";

type ImagemOficial = {
  familia: string;
  slug: string;
};

const TENANT_SLUG = "domi-rio";
const MARCA = "Isorgan";
const APLICAR = process.argv.includes("--apply");

const IMAGENS_OFICIAIS: ImagemOficial[] = [
  { familia: "Cypertryne", slug: "cypertryne" },
  { familia: "Glifosato 480", slug: "glifosato-480" },
  { familia: "Hora 2", slug: "hora-2" },
  { familia: "Pirazol TOP", slug: "pirazol-top" },
  { familia: "Roetox", slug: "roetox" },
  { familia: "Sanepec", slug: "sanepec" },
  { familia: "Scorpfim", slug: "scorpfim" },
  { familia: "Termitox 40", slug: "termitox-40" },
  { familia: "Termitox 400", slug: "termitox-400" },
  { familia: "Termitox Spray", slug: "termitox-spray" },
  { familia: "Termitox Spray DUO", slug: "termitox-spray-duo" },
];

const porFamilia = new Map(IMAGENS_OFICIAIS.map((item) => [item.familia, item]));

function familiaDoProduto(atributos: unknown): string | null {
  if (!atributos || typeof atributos !== "object" || Array.isArray(atributos)) return null;
  const familia = (atributos as Record<string, unknown>).familia;
  return typeof familia === "string" && familia.trim() ? familia.trim() : null;
}

async function baixarImagem(item: ImagemOficial): Promise<string> {
  const origem = `https://isorgan.com.br/images/produtos/galeria/${item.slug}/1.webp`;
  const resposta = await fetch(origem);
  if (!resposta.ok) throw new Error(`Falha ao baixar ${origem}: HTTP ${resposta.status}`);
  const tipo = resposta.headers.get("content-type") ?? "";
  if (!tipo.startsWith("image/")) throw new Error(`Resposta de ${origem} não é imagem: ${tipo}`);
  const bytes = Buffer.from(await resposta.arrayBuffer());
  if (bytes.length < 10_000) throw new Error(`Imagem suspeita em ${origem}: ${bytes.length} bytes`);
  const diretorio = path.join(process.cwd(), "uploads", TENANT_SLUG);
  await mkdir(diretorio, { recursive: true });
  await writeFile(path.join(diretorio, `${MARCA.toLowerCase()}-${item.slug}.webp`), bytes);
  return origem;
}

async function main() {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: TENANT_SLUG } });
  const produtos = await prisma.produto.findMany({
    where: { tenantId: tenant.id, ativo: true },
    select: {
      id: true,
      nome: true,
      sku: true,
      atributos: true,
      imagens: true,
      imagemOrigem: true,
      imagemFamilia: true,
      midias: {
        where: { varianteId: null, tipo: "imagem" },
        select: { url: true, origem: true, fonte: true, textoAlternativo: true },
      },
    },
    orderBy: { nome: "asc" },
  });

  const correspondencias = produtos.flatMap((produto) => {
    const familia = familiaDoProduto(produto.atributos);
    const imagem = familia ? porFamilia.get(familia) : undefined;
    return imagem ? [{ produto, imagem }] : [];
  });
  const semImagemOficial = produtos.filter(
    (produto) => !porFamilia.has(familiaDoProduto(produto.atributos) ?? ""),
  );

  console.log(JSON.stringify({
    modo: APLICAR ? "aplicar" : "simular",
    ativos: produtos.length,
    correspondencias: correspondencias.length,
    publicadosNoDominio: produtos.filter((produto) =>
      produto.imagens.some((url) => url.startsWith("https://domiriodistribuidora.com.br/uploads/domi-rio/isorgan-"))
      && produto.imagemOrigem === "representativa"
      && produto.imagemFamilia
      && produto.midias.some((midia) =>
        midia.url.startsWith("https://domiriodistribuidora.com.br/uploads/domi-rio/isorgan-")
        && midia.origem === "representativa"
        && midia.fonte?.startsWith("https://isorgan.com.br/produtos/")
        && midia.textoAlternativo,
      ),
    ).length,
    semImagemOficial: semImagemOficial.map((produto) => ({ sku: produto.sku, nome: produto.nome })),
  }, null, 2));

  if (!APLICAR) return;

  const fontes = new Map<string, string>();
  for (const imagem of IMAGENS_OFICIAIS) fontes.set(imagem.familia, await baixarImagem(imagem));

  for (const { produto, imagem } of correspondencias) {
    const url = `https://domiriodistribuidora.com.br/uploads/${TENANT_SLUG}/${MARCA.toLowerCase()}-${imagem.slug}.webp`;
    await salvarProdutoNoCatalogo(tenant.id, produto.id, {
      imagens: [url],
      imagemOrigem: "representativa",
      imagemFamilia: imagem.familia,
    }, {
      origem: "pesquisa-oficial-isorgan",
      metadadosMidia: {
        fonte: `https://isorgan.com.br/produtos/${imagem.slug}`,
        correspondencia: "nao_confirmada",
      },
    });
    await prisma.midiaProduto.updateMany({
      where: { tenantId: tenant.id, produtoId: produto.id, varianteId: null, url },
      data: { textoAlternativo: `${produto.nome} - produto ${MARCA}` },
    });
  }

  console.log(JSON.stringify({ publicados: correspondencias.length, fontes: [...fontes.values()] }));
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
