import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const aplicar = process.argv.includes("--apply");

const apresentacoes = new Map([
  ["ISO014", ["CYPERTRYNE - 100 mL", "100 mL"]],
  ["ISO015", ["CYPERTRYNE - 1 L", "1 L"]],
  ["ISO140", ["CYPERTRYNE - 35 mL", "35 mL"]],
  ["ISO155", ["PIRAZOL TOP - 5 mL", "5 mL"]],
  ["ISO202", ["PIRAZOL TOP - 100 mL", "100 mL"]],
  ["ISO189", ["PIRAZOL TOP - 1 L", "1 L"]],
  ["ISO276", ["SANEPEC - 100 mL", "100 mL"]],
  ["ISO287", ["SANEPEC - 1 L", "1 L"]],
  ["ISO245", ["SCORPFIM - 120 mL", "120 mL"]],
  ["ISO244", ["SCORPFIM - 500 mL", "500 mL"]],
  ["ISO002", ["TERMITOX 40 - 100 mL", "100 mL"]],
  ["ISO095", ["TERMITOX 40 - 1 L", "1 L"]],
  ["ISO003", ["TERMITOX 40 - 500 mL", "500 mL"]],
  ["ISO001", ["TERMITOX 40 - 60 mL", "60 mL"]],
  ["ISO008", ["TERMITOX 400 - 100 mL", "100 mL"]],
  ["ISO009", ["TERMITOX 400 - 1 L", "1 L"]],
  ["ISO184", ["TERMITOX 400 - 20 mL", "20 mL"]],
  ["ISO007", ["TERMITOX 400 - 35 mL", "35 mL"]],
  ["ISO283", ["TERMITOX 400 - 500 mL", "500 mL"]],
  ["ISO150", ["TERMITOX SPRAY - 120 mL", "120 mL"]],
  ["ISO013", ["TERMITOX SPRAY - 500 mL", "500 mL"]],
  ["ISO011", ["TERMITOX SPRAY - 60 mL", "60 mL"]],
  ["ISO018", ["TERMITOX SPRAY DUO - 120 mL", "120 mL"]],
  ["ISO019", ["TERMITOX SPRAY DUO - 500 mL", "500 mL"]],
  ["ISO017", ["TERMITOX SPRAY DUO - 60 mL", "60 mL"]],
]);

function objeto(valor) {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? valor : {};
}

function jsonSeguro(valor) {
  return JSON.parse(JSON.stringify(valor));
}

async function main() {
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { slug: "domi-rio" }, select: { id: true, nome: true } });
  const produtos = await prisma.produto.findMany({
    where: { tenantId: tenant.id, ativo: true },
    select: { id: true, sku: true, nome: true, atributos: true, versaoCatalogo: true },
    orderBy: { nome: "asc" },
  });

  const alteracoes = produtos.flatMap((produto) => {
    const atributosAtuais = objeto(produto.atributos);
    const atributos = { ...atributosAtuais };
    delete atributos.apresentacoes_fabricante;
    const confirmada = produto.sku ? apresentacoes.get(produto.sku) : undefined;
    if (confirmada) atributos.apresentacaoComercial = confirmada[1];
    const nome = confirmada?.[0] ?? produto.nome;
    if (nome === produto.nome && JSON.stringify(atributos) === JSON.stringify(atributosAtuais)) return [];
    return [{ produto, nome, atributos }];
  });

  console.log(JSON.stringify({
    modo: aplicar ? "aplicar" : "simular",
    loja: tenant.nome,
    ativos: produtos.length,
    alteracoes: alteracoes.map(({ produto, nome, atributos }) => ({
      id: produto.id,
      sku: produto.sku,
      nomeAnterior: produto.nome,
      nomeNovo: nome,
      atributosAnteriores: produto.atributos,
      atributosNovos: atributos,
    })),
  }, null, 2));

  if (!aplicar) return;

  for (const { produto, nome, atributos } of alteracoes) {
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT set_config('lojas.catalogo_escrita', 'on', true)`;
      const antes = await tx.produto.findUniqueOrThrow({ where: { id: produto.id } });
      const atualizado = await tx.produto.update({
        where: { id: produto.id },
        data: { nome, atributos, versaoCatalogo: { increment: 1 } },
      });
      await tx.historicoCatalogo.create({
        data: {
          tenantId: tenant.id,
          produtoId: produto.id,
          versao: atualizado.versaoCatalogo,
          origem: "revisao-apresentacoes-domirio",
          campos: ["nome", "atributos"],
          antes: jsonSeguro(antes),
          depois: jsonSeguro(atualizado),
        },
      });
      await tx.eventoCatalogo.create({ data: { tenantId: tenant.id, produtoId: produto.id, versao: atualizado.versaoCatalogo } });
    });
  }

  console.log(JSON.stringify({ publicado: true, produtosAtualizados: alteracoes.length }));
}

main()
  .catch((erro) => {
    console.error(erro);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
