import { prisma } from "../src/lib/db";

const APLICAR = process.argv.includes("--apply");
const EXPORTAR = process.argv.includes("--export");
const BASE = "/media/domirio";

const capas: Record<string, string> = {
  "Controle de Pragas": `${BASE}/categoria-controle-de-pragas.webp`,
  "Controle de Odores": `${BASE}/categoria-controle-de-odores.webp`,
  "Controle de Roedores": `${BASE}/categoria-controle-de-roedores.webp`,
  Herbicidas: `${BASE}/categoria-herbicidas.webp`,
};

async function main() {
  const tenant = await prisma.tenant.findUniqueOrThrow({
    where: { slug: "domi-rio" },
    select: {
      id: true,
      nome: true,
      bannerUrl: true,
      tema: true,
      categorias: {
        select: { id: true, nome: true, slug: true, imagemUrl: true },
        orderBy: { nome: "asc" },
      },
    },
  });

  const temaAtual = tenant.tema && typeof tenant.tema === "object" && !Array.isArray(tenant.tema)
    ? tenant.tema as Record<string, unknown>
    : {};
  if (EXPORTAR) {
    console.log(JSON.stringify(tenant, null, 2));
    return;
  }
  const temaNovo = {
    ...temaAtual,
    layout: "distribuidora",
    corPrimaria: "#34359b",
    corPrimariaTexto: "#ffffff",
    fonte: "poppins",
    raio: "suave",
    categoriaSemImagem: "ocultar",
    heroTitulo: "Proteção profissional para cada ambiente",
    heroTexto: "Soluções para controle de pragas, odores, roedores e ervas com entrega para todo o Brasil.",
    campanhasHome: [{
      imagemUrl: `${BASE}/hero-desktop-v2.webp`,
      imagemMobileUrl: `${BASE}/hero-mobile-v2.webp`,
      link: "/produtos",
      alt: "Equipamentos profissionais para controle de pragas e saneamento",
    }],
  };

  const categoriasEncontradas = tenant.categorias.filter((categoria) => capas[categoria.nome]);
  const categoriasAusentes = Object.keys(capas).filter(
    (nome) => !tenant.categorias.some((categoria) => categoria.nome === nome),
  );

  console.log(JSON.stringify({
    modo: APLICAR ? "aplicar" : "simular",
    loja: tenant.nome,
    bannerAnterior: tenant.bannerUrl,
    layoutAnterior: temaAtual.layout ?? null,
    categoriasEncontradas: categoriasEncontradas.map((categoria) => ({
      nome: categoria.nome,
      slug: categoria.slug,
      imagemAnterior: categoria.imagemUrl,
      imagemNova: capas[categoria.nome],
    })),
    categoriasAusentes,
  }, null, 2));

  if (!APLICAR) return;

  await prisma.$transaction(async (tx) => {
    await tx.tenant.update({
      where: { id: tenant.id },
      data: { bannerUrl: `${BASE}/hero-desktop-v2.webp`, tema: temaNovo },
    });
    for (const categoria of categoriasEncontradas) {
      await tx.categoria.update({
        where: { id: categoria.id },
        data: { imagemUrl: capas[categoria.nome] },
      });
    }
  });

  console.log(JSON.stringify({ publicado: true, categorias: categoriasEncontradas.length }));
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
