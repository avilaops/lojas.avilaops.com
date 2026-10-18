/**
 * Loja fictícia do modelo Ateliê. Não é cliente: nome, CNPJ e contato são de
 * mentira e servem para ver a home e tirar o print.
 *   npx tsx scripts/seed-atelie.ts
 * Depois, com LOJAS_TEMPLATE_ATELIE=1 e LOJAS_BASE_DOMAIN=localhost:
 *   http://linho-vento.localhost:3080
 */
import { Prisma } from "@prisma/client";
import { PALETA_ATELIE } from "../src/lib/atelie";
import { salvarProdutoNoCatalogo } from "../src/lib/catalogo-escrita";
import { prisma } from "../src/lib/db";
import { IdentidadeSchema } from "../src/lib/identidade";
import { TemaSchema } from "../src/lib/tema";

const tema = TemaSchema.parse({
  ...PALETA_ATELIE,
  layout: "atelie",
  mostrarNomeNoCabecalho: true,
  heroTitulo: "Coleção Brisa",
  heroTexto: "Linho lavado, cortes amplos e cores de areia.",
  atelie: {
    heroLink: "/produtos",
    sobre: "Peças leves para dias longos. Loja de demonstração com dados fictícios para o modelo de vitrine.",
    looks: [
      { titulo: "Look 01", imagem: "/media/atelie/look-01.svg", produtos: ["vestido-duna-midi", "bolsa-palha-media"] },
      { titulo: "Look 02", imagem: "/media/atelie/look-02.svg", produtos: ["camisa-mare-linho", "calca-areia-pantalona"] },
    ],
  },
});

const identidade = IdentidadeSchema.parse({
  segmento: "moda",
  publico: "Quem procura linho e corte amplo para o calor.",
  diferencial: "Peças leves para dias longos, em uma vitrine de demonstração.",
  personalidade: ["sofisticada", "artesanal"],
  tomDeVoz: "inspirador",
  objetivo: "posicionar",
  estiloFotografico: "editorial",
  palavrasChave: ["Moda"],
});

const categorias = [
  { slug: "vestidos", nome: "Vestidos", imagemUrl: "/media/atelie/cat-vestidos.svg", ordem: 1 },
  { slug: "camisas", nome: "Camisas", imagemUrl: "/media/atelie/cat-camisas.svg", ordem: 2 },
  { slug: "calcas", nome: "Calças", imagemUrl: "/media/atelie/cat-calcas.svg", ordem: 3 },
  { slug: "acessorios", nome: "Acessórios", imagemUrl: "/media/atelie/cat-acessorios.svg", ordem: 4 },
];

const pecas = [
  { slug: "vestido-duna-midi", nome: "Vestido Duna midi", categoria: "vestidos", precoCentavos: 38900, tecido: "Linho lavado", imagem: "/media/atelie/vestido.svg", descricaoCurta: "Alça larga, barra midi e linho lavado." },
  { slug: "camisa-mare-linho", nome: "Camisa Maré linho", categoria: "camisas", precoCentavos: 24900, tecido: "Linho", imagem: "/media/atelie/camisa.svg", descricaoCurta: "Camisa solta de linho, punho largo." },
  { slug: "calca-areia-pantalona", nome: "Calça Areia pantalona", categoria: "calcas", precoCentavos: 27900, tecido: "Viscose de linho", imagem: "/media/atelie/calca.svg", descricaoCurta: "Pantalona de cós alto, caimento reto." },
  { slug: "bolsa-palha-media", nome: "Bolsa Palha média", categoria: "acessorios", precoCentavos: 15900, tecido: "Palha trançada", imagem: "/media/atelie/bolsa.svg", descricaoCurta: "Bolsa média de palha, alça curta." },
];

function json(valor: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(valor)) as Prisma.InputJsonValue;
}

async function main() {
  const dados = {
    nome: "Linho & Vento",
    status: "ATIVA" as const,
    plano: "LOJA" as const,
    segmento: "moda",
    slogan: "Linho lavado, cortes amplos e cores de areia.",
    sobre: "Peças leves para dias longos. Loja de demonstração com dados fictícios para o modelo de vitrine.",
    whatsapp: "5511900000000",
    emailContato: "contato@linho-vento.test",
    razaoSocial: "Linho e Vento Comércio de Roupas Ltda.",
    cnpj: "00000000000100",
    avisoTopo: "Trocas grátis em 30 dias · Frete grátis acima de R$ 299",
    freteGratisAcima: 29900,
    logoUrl: "/media/atelie/logo.svg",
    bannerUrl: "/media/atelie/hero.svg",
    enderecoPublico: false,
    endereco: { logradouro: "Rua das Dunas", numero: "120", bairro: "Areia", cidade: "Litoral", uf: "SP", cep: "01001000" },
    tema: json(tema),
    identidade: json(identidade),
    camposPersonalizados: [{ chave: "tecido", rotulo: "Tecido", tipo: "texto", ajuda: "Fibra e toque da peça.", estado: "ativo" }],
  };
  const loja = await prisma.tenant.upsert({
    where: { slug: "linho-vento" },
    update: dados,
    create: { slug: "linho-vento", ...dados },
  });

  const ids = new Map<string, string>();
  for (const categoria of categorias) {
    const gravada = await prisma.categoria.upsert({
      where: { tenantId_slug: { tenantId: loja.id, slug: categoria.slug } },
      update: { nome: categoria.nome, imagemUrl: categoria.imagemUrl, ordem: categoria.ordem },
      create: { tenantId: loja.id, ...categoria },
    });
    ids.set(categoria.slug, gravada.id);
  }

  for (const peca of pecas) {
    const existente = await prisma.produto.findUnique({
      where: { tenantId_slug: { tenantId: loja.id, slug: peca.slug } },
      select: { id: true },
    });
    await salvarProdutoNoCatalogo(loja.id, existente?.id ?? null, {
      nome: peca.nome,
      slug: peca.slug,
      categoriaId: ids.get(peca.categoria) ?? null,
      precoCentavos: peca.precoCentavos,
      destaque: true,
      ativo: true,
      disponibilidade: "in_stock",
      estoque: 12,
      pesoKg: 0.4,
      descricaoCurta: peca.descricaoCurta,
      descricao: `${peca.descricaoCurta} Peça fictícia da vitrine Linho & Vento.`,
      imagens: [peca.imagem],
      camposPersonalizados: { tecido: peca.tecido },
    });
  }

  console.log("Loja fictícia pronta: linho-vento (Linho & Vento).");
}

main().finally(() => prisma.$disconnect());
