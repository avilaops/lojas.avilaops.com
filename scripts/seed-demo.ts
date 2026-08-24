/**
 * Cria a loja "demo" com um catálogo de exemplo.
 *   npx tsx scripts/seed-demo.ts
 * Depois: http://demo.localhost:3070 (o Chrome resolve *.localhost sozinho)
 * com LOJAS_BASE_DOMAIN=localhost no .env.
 */
import { PrismaClient } from "@prisma/client";
import { importarProdutos } from "../src/lib/admin-tenants";

const prisma = new PrismaClient();

async function main() {
  const t = await prisma.tenant.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      slug: "demo",
      nome: "Loja Demo",
      status: "ATIVA",
      plano: "LOJA",
      slogan: "Tudo para o seu dia a dia, com entrega rápida",
      sobre: "Loja de demonstração da plataforma lojas.avilaops.com.\n\nTodos os produtos são fictícios.",
      whatsapp: "5516999999999",
      emailContato: "contato@demo.test",
      endereco: { logradouro: "Rua Exemplo", numero: "100", bairro: "Centro", cidade: "Ribeirão Preto", uf: "SP", cep: "14010000" },
      horario: "Seg a Sex 8h–18h",
      cepOrigem: "14010000",
      tema: { corPrimaria: "#0f766e", fonte: "inter", raio: "suave" },
      tabelaFrete: [
        { ufs: ["SP"], preco: 1490, prazoDiasUteis: 3, nome: "Entrega SP" },
        { ufs: ["*"], preco: 2990, prazoDiasUteis: 8, nome: "Entrega Brasil" },
      ],
      freteGratisAcima: 20000,
    },
  });

  const r = await importarProdutos(t.id, [
    { nome: "Camiseta básica algodão", categoria: "Vestuário", sku: "CAM-001", precoCentavos: 5990, precoDeCentavos: 7990, destaque: true, descricaoCurta: "100% algodão, corte regular.", pesoKg: 0.25 },
    { nome: "Caneca cerâmica 300ml", categoria: "Casa", sku: "CAN-001", precoCentavos: 3490, destaque: true, descricaoCurta: "Vai ao micro-ondas e à lava-louças.", pesoKg: 0.4 },
    { nome: "Garrafa térmica 500ml", categoria: "Casa", sku: "GAR-001", precoCentavos: 8990, descricaoCurta: "Mantém a temperatura por 12 horas.", pesoKg: 0.35 },
    { nome: "Boné aba curva", categoria: "Vestuário", sku: "BON-001", precoCentavos: 4990, disponibilidade: "out_of_stock", pesoKg: 0.12 },
  ]);

  console.log(`Loja demo pronta: ${r.criados} produtos criados, ${r.atualizados} atualizados.`);
}

main().finally(() => prisma.$disconnect());
