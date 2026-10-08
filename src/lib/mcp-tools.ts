import { z } from "zod";
import { prisma } from "@/lib/db";
import { slugificar, formatarBRL } from "@/lib/catalogo";
import { emitirEtiqueta } from "@/lib/postagem";
import { urlDaLoja, temaDo } from "@/lib/tenant";
import { VALORES_LAYOUT, mesclarTema, type TemaLoja } from "@/lib/tema";
import { resumoDeVendas } from "@/lib/relatorio";
import { gerarRascunhoSeoCategoria, publicarSeoCategoria } from "@/lib/seo-categorias";
import { avisarBuscadores } from "@/lib/indexnow";
import { emitir } from "@/lib/eventos";
import type { Tenant, PedidoStatus } from "@prisma/client";
import { invalidarCatalogo } from "./catalogo-cache";
import { salvarProdutoNoCatalogo } from "./catalogo-escrita";

export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  // Os argumentos são validados por ferramenta antes de qualquer escrita.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handler: (args: Record<string, any>, context: { tenant: Tenant; isAdmin: boolean }) => Promise<unknown>;
}

export const MCP_TOOLS: McpTool[] = [
  // 1. Informações da Loja
  {
    name: "obter_loja",
    description: "Retorna as informações gerais da loja ativa (nome, plano, layout atual, tema, URLs, contato e estatísticas).",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async (_args, { tenant }) => {
      const tema = temaDo(tenant);
      const [totalProdutos, totalPedidos] = await Promise.all([
        prisma.produto.count({ where: { tenantId: tenant.id } }),
        prisma.pedido.count({ where: { tenantId: tenant.id } }),
      ]);

      return {
        slug: tenant.slug,
        nome: tenant.nome,
        plano: tenant.plano,
        status: tenant.status,
        url: urlDaLoja(tenant),
        dominioPrincipal: tenant.dominioPrincipal,
        slogan: tenant.slogan,
        whatsapp: tenant.whatsapp,
        emailContato: tenant.emailContato,
        layout: tema.layout,
        corPrimaria: tema.corPrimaria,
        modo: tema.modo,
        fonte: tema.fonte,
        totalProdutos,
        totalPedidos,
      };
    },
  },

  // 2. Atualizar Marca e Layout
  {
    name: "atualizar_marca",
    description: `Atualiza o layout da loja (dentre os ${VALORES_LAYOUT.length} modelos: ${VALORES_LAYOUT.join(", ")}), cores, slogan, modo e avisos.`,
    inputSchema: {
      type: "object",
      properties: {
        layout: {
          type: "string",
          enum: VALORES_LAYOUT,
          description: "Modelo visual da página inicial da loja.",
        },
        corPrimaria: { type: "string", description: "Cor primária em formato hexadecimal (ex: #2563eb ou #c62828)." },
        modo: { type: "string", enum: ["claro", "escuro"], description: "Modo visual claro ou escuro." },
        fonte: { type: "string", enum: ["sistema", "inter", "poppins", "montserrat", "playfair"], description: "Tipografia da loja." },
        slogan: { type: "string", description: "Frase de efeito / proposta de valor principal da loja." },
        avisoTopo: { type: "string", description: "Barra fina de anúncio no topo da loja (ex: Frete grátis acima de R$ 199)." },
      },
    },
    handler: async (args, { tenant }) => {
      // O enum acima é o que a ferramenta anuncia; validar de novo é o que
      // impede um cliente MCP distraído de gravar um tema que a leitura
      // seguinte descarta inteiro.
      const novoTema = mesclarTema(temaDo(tenant), {
        ...(args.layout ? { layout: args.layout as TemaLoja["layout"] } : {}),
        ...(args.corPrimaria ? { corPrimaria: args.corPrimaria as string } : {}),
        ...(args.modo ? { modo: args.modo as TemaLoja["modo"] } : {}),
        ...(args.fonte ? { fonte: args.fonte as TemaLoja["fonte"] } : {}),
      });
      if (!novoTema) throw new Error(`Tema inválido. Layouts: ${VALORES_LAYOUT.join(", ")}. Cor em hexadecimal (#rrggbb).`);

      const atualizado = await prisma.tenant.update({
        where: { id: tenant.id },
        data: {
          tema: novoTema,
          ...(args.slogan !== undefined ? { slogan: args.slogan } : {}),
          ...(args.avisoTopo !== undefined ? { avisoTopo: args.avisoTopo } : {}),
        },
      });

      return {
        sucesso: true,
        mensagem: "Identidade visual da loja atualizada com sucesso.",
        layout: novoTema.layout,
        corPrimaria: novoTema.corPrimaria,
        slogan: atualizado.slogan,
        avisoTopo: atualizado.avisoTopo,
      };
    },
  },

  // 3. Listar Produtos
  {
    name: "listar_produtos",
    description: "Lista os produtos cadastrados na loja com filtros por busca, categoria, status e destaque.",
    inputSchema: {
      type: "object",
      properties: {
        busca: { type: "string", description: "Termo de busca para pesquisar no nome ou descrição." },
        categoriaSlug: { type: "string", description: "Filtrar por slug da categoria." },
        destaque: { type: "boolean", description: "Filtrar apenas produtos em destaque." },
        ativo: { type: "boolean", description: "Filtrar por produtos ativos (visíveis na loja)." },
        limite: { type: "number", description: "Quantidade máxima de produtos retornados (padrão: 20)." },
      },
    },
    handler: async (args, { tenant }) => {
      const limite = Math.min(Number(args.limite) || 20, 100);
      const produtos = await prisma.produto.findMany({
        where: {
          tenantId: tenant.id,
          ...(args.ativo !== undefined ? { ativo: args.ativo } : {}),
          ...(args.destaque !== undefined ? { destaque: args.destaque } : {}),
          ...(args.busca ? { busca: { contains: args.busca.toLowerCase() } } : {}),
          ...(args.categoriaSlug ? { categoria: { slug: args.categoriaSlug } } : {}),
        },
        include: { categoria: { select: { nome: true, slug: true } } },
        orderBy: { criadoEm: "desc" },
        take: limite,
      });

      return {
        total: produtos.length,
        produtos: produtos.map((p) => ({
          id: p.id,
          slug: p.slug,
          nome: p.nome,
          precoReais: p.precoCentavos / 100,
          precoFormatado: formatarBRL(p.precoCentavos),
          precoDeReais: p.precoDeCentavos ? p.precoDeCentavos / 100 : null,
          estoque: p.estoque,
          ativo: p.ativo,
          destaque: p.destaque,
          categoria: p.categoria?.nome || null,
          fotoPrincipal: p.imagens[0] || null,
          totalFotos: p.imagens.length,
        })),
      };
    },
  },

  // 4. Obter Detalhes do Produto
  {
    name: "obter_produto",
    description: "Obtém detalhes completos de um produto por ID ou slug, incluindo variações e estoque.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID único do produto." },
        slug: { type: "string", description: "Slug do produto na loja." },
      },
    },
    handler: async (args, { tenant }) => {
      if (!args.id && !args.slug) throw new Error("Informe o 'id' ou o 'slug' do produto.");

      const produto = await prisma.produto.findFirst({
        where: {
          tenantId: tenant.id,
          ...(args.id ? { id: args.id } : { slug: args.slug }),
        },
        include: {
          categoria: true,
          variantes: { where: { ativo: true } },
        },
      });

      if (!produto) throw new Error("Produto não encontrado.");

      return {
        id: produto.id,
        slug: produto.slug,
        nome: produto.nome,
        precoReais: produto.precoCentavos / 100,
        precoDeReais: produto.precoDeCentavos ? produto.precoDeCentavos / 100 : null,
        estoque: produto.estoque,
        marca: produto.marca,
        sku: produto.sku,
        descricaoCurta: produto.descricaoCurta,
        descricao: produto.descricao,
        imagens: produto.imagens,
        opcoes: produto.opcoes,
        variantes: produto.variantes.map((v) => ({
          id: v.id,
          nome: v.nome,
          valores: v.valores,
          precoReais: v.precoCentavos ? v.precoCentavos / 100 : produto.precoCentavos / 100,
          estoque: v.estoque,
          sku: v.sku,
        })),
        categoria: produto.categoria ? { id: produto.categoria.id, nome: produto.categoria.nome, slug: produto.categoria.slug } : null,
        linkLoja: `${urlDaLoja(tenant)}/produtos/${produto.slug}`,
      };
    },
  },

  // 5. Cadastrar Produto
  {
    name: "criar_produto",
    description: "Cadastra um novo produto na loja com preço em reais, estoque, categoria, fotos e medidas para frete.",
    inputSchema: {
      type: "object",
      properties: {
        nome: { type: "string", description: "Nome do produto." },
        precoReais: { type: "number", description: "Preço de venda em Reais (ex: 129.90)." },
        precoDeReais: { type: "number", description: "Preço anterior / 'De' em Reais para exibir desconto (ex: 159.90)." },
        estoque: { type: "number", description: "Quantidade em estoque (deixe vazio para ilimitado)." },
        categoriaNome: { type: "string", description: "Nome da categoria (será criada se não existir)." },
        marca: { type: "string", description: "Marca ou fabricante." },
        sku: { type: "string", description: "Código SKU do produto." },
        descricaoCurta: { type: "string", description: "Resumo em 1-2 frases para vitrine." },
        descricao: { type: "string", description: "Descrição detalhada do produto." },
        imagens: { type: "array", items: { type: "string" }, description: "URLs das imagens do produto." },
        destaque: { type: "boolean", description: "Marcar como produto em destaque na home." },
        pesoKg: { type: "number", description: "Peso em kg para cálculo de frete (ex: 0.5)." },
        opcoes: { type: "array", items: { type: "string" }, description: "Nomes das opções se houver variação (ex: ['Tamanho', 'Cor'])." },
      },
      required: ["nome", "precoReais"],
    },
    handler: async (args, { tenant }) => {
      const precoCentavos = Math.round(Number(args.precoReais) * 100);
      if (precoCentavos <= 0) throw new Error("O preço do produto deve ser maior que zero.");

      const precoDeCentavos = args.precoDeReais ? Math.round(Number(args.precoDeReais) * 100) : null;
      const slugBase = slugificar(args.nome);
      let slug = slugBase;
      let tentativa = 1;

      while (await prisma.produto.findUnique({ where: { tenantId_slug: { tenantId: tenant.id, slug } } })) {
        slug = `${slugBase}-${++tentativa}`;
      }

      let categoriaId: string | null = null;
      if (args.categoriaNome) {
        const cslug = slugificar(args.categoriaNome);
        const cat = await prisma.categoria.upsert({
          where: { tenantId_slug: { tenantId: tenant.id, slug: cslug } },
          create: { tenantId: tenant.id, slug: cslug, nome: args.categoriaNome },
          update: {},
        });
        categoriaId = cat.id;
      }

      const produto = await salvarProdutoNoCatalogo(tenant.id, null, {
          slug,
          nome: args.nome,
          precoCentavos,
          precoDeCentavos,
          estoque: args.estoque !== undefined ? Number(args.estoque) : null,
          categoriaId,
          marca: args.marca || null,
          sku: args.sku || null,
          descricaoCurta: args.descricaoCurta || null,
          descricao: args.descricao || null,
          imagens: Array.isArray(args.imagens) ? args.imagens : [],
          destaque: Boolean(args.destaque),
          pesoKg: args.pesoKg ? Number(args.pesoKg) : null,
          opcoes: Array.isArray(args.opcoes) ? args.opcoes : [],
      }, { origem: "mcp" });
      invalidarCatalogo(tenant.id);

      return {
        sucesso: true,
        mensagem: `Produto "${produto.nome}" criado com sucesso!`,
        id: produto.id,
        slug: produto.slug,
        precoFormatado: formatarBRL(produto.precoCentavos),
        linkLoja: `${urlDaLoja(tenant)}/produtos/${produto.slug}`,
      };
    },
  },

  // 6. Atualizar Produto
  {
    name: "atualizar_produto",
    description: "Atualiza campos de um produto existente (preço, estoque, descrição, imagens, status).",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID do produto a atualizar." },
        nome: { type: "string", description: "Novo nome do produto." },
        precoReais: { type: "number", description: "Novo preço em Reais." },
        precoDeReais: { type: "number", description: "Novo preço anterior em Reais." },
        estoque: { type: "number", description: "Nova quantidade em estoque." },
        ativo: { type: "boolean", description: "Visibilidade do produto na loja." },
        destaque: { type: "boolean", description: "Destaque na página inicial." },
        descricaoCurta: { type: "string", description: "Resumo do produto." },
        descricao: { type: "string", description: "Descrição longa." },
        imagens: { type: "array", items: { type: "string" }, description: "Lista de URLs de imagens (substitui a galeria inteira; para adicionar/remover uma foto use gerenciar_fotos_produto)." },
        marca: { type: "string", description: "Marca ou fabricante." },
        sku: { type: "string", description: "Código SKU (só produto sem variações; com variações, edite na grade)." },
        gtin: { type: "string", description: "Código de barras EAN/GTIN (só produto sem variações)." },
        pesoKg: { type: "number", description: "Peso em kg para frete (ex: 0.5). Só produto sem variações." },
        alturaCm: { type: "number", description: "Altura da embalagem em cm. Só produto sem variações." },
        larguraCm: { type: "number", description: "Largura da embalagem em cm. Só produto sem variações." },
        comprimentoCm: { type: "number", description: "Comprimento da embalagem em cm. Só produto sem variações." },
        categoriaNome: { type: "string", description: "Nome da categoria (será criada se não existir)." },
        atributos: { type: "object", description: "Características livres exibidas na ficha, ex: { \"cor\": \"azul\", \"volumeMl\": 500 }." },
      },
      required: ["id"],
    },
    handler: async (args, { tenant }) => {
      const p = await prisma.produto.findFirst({
        where: { id: args.id, tenantId: tenant.id },
      });
      if (!p) throw new Error("Produto não encontrado nesta loja.");

      let categoriaId: string | undefined;
      if (args.categoriaNome) {
        const cslug = slugificar(args.categoriaNome);
        const cat = await prisma.categoria.upsert({
          where: { tenantId_slug: { tenantId: tenant.id, slug: cslug } },
          create: { tenantId: tenant.id, slug: cslug, nome: args.categoriaNome },
          update: {},
        });
        categoriaId = cat.id;
      }

      const atualizado = await salvarProdutoNoCatalogo(tenant.id, args.id, {
          ...(args.nome ? { nome: args.nome } : {}),
          ...(args.precoReais !== undefined ? { precoCentavos: Math.round(Number(args.precoReais) * 100) } : {}),
          ...(args.precoDeReais !== undefined ? { precoDeCentavos: args.precoDeReais ? Math.round(Number(args.precoDeReais) * 100) : null } : {}),
          ...(args.estoque !== undefined ? { estoque: Number(args.estoque) } : {}),
          ...(args.ativo !== undefined ? { ativo: Boolean(args.ativo) } : {}),
          ...(args.destaque !== undefined ? { destaque: Boolean(args.destaque) } : {}),
          ...(args.descricaoCurta !== undefined ? { descricaoCurta: args.descricaoCurta } : {}),
          ...(args.descricao !== undefined ? { descricao: args.descricao } : {}),
          ...(args.imagens !== undefined ? { imagens: args.imagens } : {}),
          ...(args.marca !== undefined ? { marca: args.marca || null } : {}),
          ...(args.sku !== undefined ? { sku: args.sku || null } : {}),
          ...(args.gtin !== undefined ? { gtin: args.gtin || null } : {}),
          ...(args.pesoKg !== undefined ? { pesoKg: args.pesoKg ? Number(args.pesoKg) : null } : {}),
          ...(args.alturaCm !== undefined ? { alturaCm: args.alturaCm ? Number(args.alturaCm) : null } : {}),
          ...(args.larguraCm !== undefined ? { larguraCm: args.larguraCm ? Number(args.larguraCm) : null } : {}),
          ...(args.comprimentoCm !== undefined ? { comprimentoCm: args.comprimentoCm ? Number(args.comprimentoCm) : null } : {}),
          ...(args.atributos !== undefined ? { atributos: args.atributos } : {}),
          ...(categoriaId !== undefined ? { categoriaId } : {}),
      }, { origem: "mcp" });
      invalidarCatalogo(tenant.id);

      return {
        sucesso: true,
        mensagem: `Produto "${atualizado.nome}" atualizado.`,
        preco: formatarBRL(atualizado.precoCentavos),
        estoque: atualizado.estoque,
        ativo: atualizado.ativo,
      };
    },
  },

  // 7. Criar Cupom de Desconto
  {
    name: "criar_cupom",
    description: "Cria um cupom de desconto para a loja (Percentual, Valor Fixo em Reais ou Frete Grátis).",
    inputSchema: {
      type: "object",
      properties: {
        codigo: { type: "string", description: "Código do cupom (ex: PROMO15, FRETEGRATIS)." },
        tipo: { type: "string", enum: ["PERCENTUAL", "FIXO", "FRETE_GRATIS"], description: "Tipo de desconto." },
        valor: { type: "number", description: "Porcentagem (ex: 15 para 15%) ou Valor em Reais (ex: 25.00 para R$ 25 de desconto)." },
        minimoReais: { type: "number", description: "Valor mínimo do pedido em Reais para ativar o cupom." },
        usosMax: { type: "number", description: "Limite máximo de utilizações." },
      },
      required: ["codigo", "tipo"],
    },
    handler: async (args, { tenant }) => {
      const codigo = String(args.codigo).trim().toUpperCase().replace(/\s+/g, "");
      const tipo = args.tipo as "PERCENTUAL" | "FIXO" | "FRETE_GRATIS";
      let valorFinal = 0;

      if (tipo === "PERCENTUAL") {
        valorFinal = Math.min(Math.max(Number(args.valor) || 0, 1), 100);
      } else if (tipo === "FIXO") {
        valorFinal = Math.round((Number(args.valor) || 0) * 100);
      }

      const minimoCentavos = args.minimoReais ? Math.round(Number(args.minimoReais) * 100) : 0;

      const cupom = await prisma.cupom.upsert({
        where: { tenantId_codigo: { tenantId: tenant.id, codigo } },
        create: {
          tenantId: tenant.id,
          codigo,
          tipo,
          valor: valorFinal,
          minimoCentavos,
          usosMax: args.usosMax ? Number(args.usosMax) : null,
          ativo: true,
        },
        update: {
          tipo,
          valor: valorFinal,
          minimoCentavos,
          usosMax: args.usosMax ? Number(args.usosMax) : null,
          ativo: true,
        },
      });

      return {
        sucesso: true,
        codigo: cupom.codigo,
        tipo: cupom.tipo,
        beneficio: tipo === "PERCENTUAL" ? `${cupom.valor}% de desconto` : tipo === "FIXO" ? `${formatarBRL(cupom.valor)} de desconto` : "Frete Grátis",
        minimo: cupom.minimoCentavos > 0 ? formatarBRL(cupom.minimoCentavos) : "Sem valor mínimo",
      };
    },
  },

  // 8. Listar Pedidos
  {
    name: "listar_pedidos",
    description: "Lista os pedidos da loja com filtros por status (AGUARDANDO_PAGAMENTO, PAGO, EM_SEPARACAO, ENVIADO, ENTREGUE, CANCELADO).",
    inputSchema: {
      type: "object",
      properties: {
        status: {
          type: "string",
          enum: ["AGUARDANDO_PAGAMENTO", "PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE", "CANCELADO"],
          description: "Filtrar por status do pedido.",
        },
        limite: { type: "number", description: "Quantidade máxima de pedidos (padrão: 15)." },
      },
    },
    handler: async (args, { tenant }) => {
      const limite = Math.min(Number(args.limite) || 15, 50);
      const pedidos = await prisma.pedido.findMany({
        where: {
          tenantId: tenant.id,
          ...(args.status ? { status: args.status as PedidoStatus } : {}),
        },
        include: {
          itens: true,
          postagem: true,
        },
        orderBy: { criadoEm: "desc" },
        take: limite,
      });

      return {
        total: pedidos.length,
        pedidos: pedidos.map((p) => ({
          id: p.id,
          referencia: p.referencia,
          numero: p.numero,
          status: p.status,
          cliente: p.clienteNome,
          total: formatarBRL(p.totalCentavos),
          meioPagamento: p.meioPagamento,
          itensQtd: p.itens.reduce((s, i) => s + i.quantidade, 0),
          rastreio: p.rastreio || p.postagem?.codigoObjeto || null,
          data: p.criadoEm.toISOString(),
        })),
      };
    },
  },

  // 9. Emitir Etiqueta de Envio (CepCerto)
  {
    name: "emitir_etiqueta_envio",
    description: "Emite a etiqueta oficial de envio nos Correios/Jadlog/Loggi via CepCerto para um pedido pago.",
    inputSchema: {
      type: "object",
      properties: {
        pedidoId: { type: "string", description: "ID único do pedido a ser despachado." },
      },
      required: ["pedidoId"],
    },
    handler: async (args, { tenant }) => {
      const pedido = await prisma.pedido.findFirst({
        where: { id: args.pedidoId, tenantId: tenant.id },
        include: { itens: true },
      });

      if (!pedido) throw new Error("Pedido não encontrado.");
      if (pedido.status === "CANCELADO" || pedido.status === "ESTORNADO") {
        throw new Error(`Não é possível emitir etiqueta para pedido ${pedido.status}.`);
      }

      const res = await emitirEtiqueta(tenant, pedido);

      return {
        sucesso: res.status === "emitida",
        status: res.status,
        mensagem: res.mensagem,
        codigoRastreio: res.codigoObjeto,
        pdfEtiquetaUrl: res.pdfEtiqueta,
        custoFrete: formatarBRL(res.custoCentavos),
      };
    },
  },

  // 10. Resumo de Vendas e Faturamento
  {
    name: "resumo_vendas",
    description: "Retorna o relatório de desempenho financeiro da loja nos últimos 30 dias (faturamento, pedidos pagos, ticket médio e produtos mais vendidos).",
    inputSchema: {
      type: "object",
      properties: {},
    },
    handler: async (_args, { tenant }) => {
      const resumo = await resumoDeVendas(tenant.id);
      return {
        faturamento30Dias: formatarBRL(resumo.receitaCentavos),
        totalPedidosPagos: resumo.pedidos,
        ticketMedio: formatarBRL(resumo.ticketMedioCentavos),
        produtosMaisVendidos: resumo.top.map((p: { nome: string; quantidade: number; centavos: number }) => ({
          nome: p.nome,
          quantidadeVendida: p.quantidade,
          faturamento: formatarBRL(p.centavos),
        })),
      };
    },
  },

  // 11. Categorias e SEO persistido
  {
    name: "listar_categorias",
    description: "Lista as categorias da loja, quantidade de produtos e estado de publicação do SEO.",
    inputSchema: { type: "object", properties: {} },
    handler: async (_args, { tenant }) => {
      const categorias = await prisma.categoria.findMany({
        where: { tenantId: tenant.id },
        include: { _count: { select: { produtos: true } } },
        orderBy: [{ ordem: "asc" }, { nome: "asc" }],
      });
      return {
        total: categorias.length,
        categorias: categorias.map((c) => ({
          id: c.id,
          nome: c.nome,
          slug: c.slug,
          descricao: c.descricao,
          produtos: c._count.produtos,
          seo: {
            titulo: c.seoTitle,
            descricao: c.seoDescription,
            palavrasChave: c.seoKeywords,
            pendente: c.seoPendente,
            processandoEm: c.seoProcessandoEm?.toISOString() ?? null,
            erro: c.seoErro,
            origem: c.seoOrigem,
            atualizadoEm: c.seoAtualizadoEm?.toISOString() ?? null,
          },
          linkLoja: `${urlDaLoja(tenant)}/categoria/${c.slug}`,
        })),
      };
    },
  },
  {
    name: "atualizar_categoria",
    description: "Cria ou atualiza uma categoria da loja. Mudanças de nome ou descrição deixam o SEO pendente para nova revisão.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID para atualizar; omita para criar." },
        nome: { type: "string", description: "Nome público da categoria." },
        descricao: { type: "string", description: "Descrição pública da categoria." },
        imagemUrl: { type: "string", description: "URL absoluta da imagem." },
        ordem: { type: "number", description: "Posição da categoria na navegação." },
      },
      required: ["nome"],
    },
    handler: async (args, { tenant }) => {
      const entrada = z.object({
        id: z.string().min(1).optional(),
        nome: z.string().trim().min(1).max(80),
        descricao: z.string().trim().max(300).nullable().optional(),
        imagemUrl: z.string().url().nullable().optional(),
        ordem: z.number().int().min(0).max(999).optional(),
      }).parse(args);
      const atual = entrada.id
        ? await prisma.categoria.findFirst({ where: { id: entrada.id, tenantId: tenant.id } })
        : null;
      if (entrada.id && !atual) throw new Error("Categoria não encontrada nesta loja.");
      const slugNovo = slugificar(entrada.nome);
      const existentePorSlug = !atual && slugNovo
        ? await prisma.categoria.findUnique({ where: { tenantId_slug: { tenantId: tenant.id, slug: slugNovo } } })
        : null;
      const categoriaAtual = atual ?? existentePorSlug;
      const slug = categoriaAtual?.slug ?? slugNovo;
      if (!slug) throw new Error("O nome precisa conter letras ou números.");
      const conteudoMudou = !categoriaAtual || categoriaAtual.nome !== entrada.nome || (entrada.descricao !== undefined && (entrada.descricao ?? null) !== categoriaAtual.descricao);
      const categoria = categoriaAtual
        ? await prisma.categoria.update({
            where: { id: categoriaAtual.id },
            data: {
              nome: entrada.nome,
              ...(entrada.descricao !== undefined ? { descricao: entrada.descricao } : {}),
              ...(entrada.imagemUrl !== undefined ? { imagemUrl: entrada.imagemUrl } : {}),
              ...(entrada.ordem !== undefined ? { ordem: entrada.ordem } : {}),
              ...(conteudoMudou ? { seoPendente: true, seoProcessandoEm: null, seoErro: null } : {}),
            },
          })
        : await prisma.categoria.create({
            data: {
              tenantId: tenant.id,
              nome: entrada.nome,
              slug,
              descricao: entrada.descricao,
              imagemUrl: entrada.imagemUrl,
              ordem: entrada.ordem ?? await prisma.categoria.count({ where: { tenantId: tenant.id } }),
            },
          });
      if (conteudoMudou) {
        void emitir({
          tipo: "categoria.seo-pendente",
          slug: tenant.slug,
          nome: tenant.nome,
          categoriaId: categoria.id,
          categoriaSlug: categoria.slug,
          categoriaNome: categoria.nome,
          url: `${urlDaLoja(tenant)}/categoria/${categoria.slug}`,
        });
      }
      void avisarBuscadores(tenant, ["/", "/produtos", `/categoria/${categoria.slug}`, "/sitemap.xml"]);
      return { sucesso: true, categoria, linkLoja: `${urlDaLoja(tenant)}/categoria/${categoria.slug}` };
    },
  },
  {
    name: "gerar_seo_categoria",
    description: "Gera SEO usando somente dados reais da categoria. Por padrão retorna um rascunho; use publicar=true apenas após revisão.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID da categoria." },
        contexto: { type: "string", description: "Direção editorial opcional, sem fatos inventados." },
        publicar: { type: "boolean", description: "Publica o resultado imediatamente. Padrão: false." },
      },
      required: ["id"],
    },
    handler: async (args, { tenant }) => {
      const entrada = z.object({
        id: z.string().min(1),
        contexto: z.string().trim().max(500).optional(),
        publicar: z.boolean().default(false),
      }).parse(args);
      const gerado = await gerarRascunhoSeoCategoria(tenant, entrada.id, entrada.contexto);
      if (!gerado) throw new Error("Categoria não encontrada nesta loja.");
      if (!entrada.publicar) return { publicado: false, ...gerado.rascunho };
      const categoria = await publicarSeoCategoria(tenant.id, entrada.id, gerado.rascunho);
      if (!categoria) throw new Error("Categoria não encontrada nesta loja.");
      void avisarBuscadores(tenant, [`/categoria/${categoria.slug}`, "/sitemap.xml"]);
      void emitir({
        tipo: "categoria.seo-publicado",
        slug: tenant.slug,
        nome: tenant.nome,
        categoriaId: categoria.id,
        categoriaSlug: categoria.slug,
        categoriaNome: categoria.nome,
        url: `${urlDaLoja(tenant)}/categoria/${categoria.slug}`,
        origem: categoria.seoOrigem ?? "manual",
      });
      return { publicado: true, categoriaId: categoria.id, slug: categoria.slug, ...gerado.rascunho };
    },
  },

  // 14. Detalhe completo do pedido
  {
    name: "obter_pedido",
    description: "Detalhe completo de um pedido: itens, cliente, endereço de entrega, pagamento, frete, rastreio e canal de origem.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID do pedido." },
        referencia: { type: "string", description: "Referência pública do pedido (a que o cliente vê)." },
      },
    },
    handler: async (args, { tenant }) => {
      if (!args.id && !args.referencia) throw new Error("Informe o 'id' ou a 'referencia' do pedido.");
      const pedido = await prisma.pedido.findFirst({
        where: { tenantId: tenant.id, ...(args.id ? { id: args.id } : { referencia: args.referencia }) },
        include: { itens: true, postagem: true, sessao: { select: { canal: true, origem: true, campanha: true } } },
      });
      if (!pedido) throw new Error("Pedido não encontrado.");
      return {
        id: pedido.id,
        referencia: pedido.referencia,
        numero: pedido.numero,
        status: pedido.status,
        data: pedido.criadoEm.toISOString(),
        cliente: {
          nome: pedido.clienteNome,
          email: pedido.clienteEmail,
          telefone: pedido.clienteTelefone,
          documento: pedido.clienteDocumento,
        },
        entrega: pedido.entrega,
        frete: { nome: pedido.freteNome, valor: formatarBRL(pedido.freteCentavos), prazoDiasUteis: pedido.fretePrazoDiasUteis },
        pagamento: { meio: pedido.meioPagamento, gateway: pedido.gateway, status: pedido.pagamentoStatus },
        cupom: pedido.cupomCodigo,
        subtotal: formatarBRL(pedido.subtotalCentavos),
        desconto: formatarBRL(pedido.descontoCentavos),
        total: formatarBRL(pedido.totalCentavos),
        rastreio: pedido.rastreio || pedido.postagem?.codigoObjeto || null,
        canal: pedido.canal,
        atribuicao: pedido.sessao ? { canal: pedido.sessao.canal, origem: pedido.sessao.origem, campanha: pedido.sessao.campanha } : { canal: "direto" },
        itens: pedido.itens.map((i) => ({
          nome: i.nome,
          sku: i.sku,
          variante: i.varianteNome,
          quantidade: i.quantidade,
          precoUnitario: formatarBRL(i.precoUnitarioCentavos),
          subtotal: formatarBRL(i.precoUnitarioCentavos * i.quantidade),
        })),
      };
    },
  },

  // 15. Avançar a situação do pedido
  {
    name: "atualizar_status_pedido",
    description: "Avança a situação de um pedido pago (EM_SEPARACAO, ENVIADO, ENTREGUE ou CANCELADO) e dispara o aviso ao cliente. O status de pagamento muda só pelo gateway.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID do pedido." },
        status: { type: "string", enum: ["EM_SEPARACAO", "ENVIADO", "ENTREGUE", "CANCELADO"], description: "Nova situação do pedido." },
        rastreio: { type: "string", description: "Código de rastreio (opcional; entra no aviso de ENVIADO)." },
      },
      required: ["id", "status"],
    },
    handler: async (args, { tenant }) => {
      const pedido = await prisma.pedido.findFirst({ where: { id: args.id, tenantId: tenant.id } });
      if (!pedido) throw new Error("Pedido não encontrado.");
      const status = args.status as PedidoStatus;
      if (pedido.status === "AGUARDANDO_PAGAMENTO" && status !== "CANCELADO") {
        throw new Error("Pedido ainda não foi pago; no momento só é possível cancelar.");
      }
      const a = await prisma.pedido.update({
        where: { id: pedido.id },
        data: { status, ...(args.rastreio !== undefined ? { rastreio: args.rastreio || null } : {}) },
      });
      if (status !== pedido.status) {
        const comum = {
          slug: tenant.slug,
          referencia: a.referencia,
          numero: a.numero,
          clienteNome: a.clienteNome,
          clienteEmail: a.clienteEmail,
          clienteTelefone: a.clienteTelefone,
          linkPedido: `${urlDaLoja(tenant)}/pedido/${a.referencia}`,
          lojaNome: tenant.nome,
          lojaUrl: urlDaLoja(tenant),
          lojistaEmail: tenant.loginEmail ?? tenant.emailContato,
          lojistaWhatsapp: tenant.whatsapp,
          emailRemetente: tenant.emailRemetente,
        };
        if (status === "EM_SEPARACAO") await emitir({ tipo: "pedido.em-separacao", ...comum }, { chave: `em-separacao:${comum.referencia}` });
        if (status === "ENVIADO") await emitir({ tipo: "pedido.enviado", transportadora: a.freteNome, rastreio: a.rastreio, ...comum }, { chave: `enviado:${comum.referencia}` });
        if (status === "ENTREGUE") await emitir({ tipo: "pedido.entregue", ...comum }, { chave: `entregue:${comum.referencia}` });
        if (status === "CANCELADO") await emitir({ tipo: "pedido.cancelado", totalCentavos: a.totalCentavos, motivo: "cancelado pela loja", ...comum }, { chave: `cancelado:${comum.referencia}` });
      }
      return { sucesso: true, id: a.id, status: a.status, rastreio: a.rastreio };
    },
  },

  // 16. Clientes — listar (somente leitura)
  {
    name: "listar_clientes",
    description: "Lista os clientes cadastrados na loja (somente leitura), com total de pedidos. Ordena pelos mais recentes.",
    inputSchema: {
      type: "object",
      properties: {
        busca: { type: "string", description: "Filtra por nome ou e-mail." },
        limite: { type: "number", description: "Máximo de clientes (padrão 20, teto 100)." },
      },
    },
    handler: async (args, { tenant }) => {
      const limite = Math.min(Number(args.limite) || 20, 100);
      const termo = args.busca ? String(args.busca).trim() : "";
      const clientes = await prisma.comprador.findMany({
        where: {
          tenantId: tenant.id,
          ...(termo ? { OR: [{ nome: { contains: termo, mode: "insensitive" } }, { email: { contains: termo, mode: "insensitive" } }] } : {}),
        },
        include: { _count: { select: { pedidos: true } } },
        orderBy: { criadoEm: "desc" },
        take: limite,
      });
      return {
        total: clientes.length,
        clientes: clientes.map((c) => ({
          id: c.id,
          nome: c.nome,
          email: c.email,
          telefone: c.telefone,
          pedidos: c._count.pedidos,
          desde: c.criadoEm.toISOString(),
          ultimoAcesso: c.ultimoAcesso?.toISOString() ?? null,
        })),
      };
    },
  },

  // 17. Cliente — detalhe (somente leitura)
  {
    name: "obter_cliente",
    description: "Detalhe de um cliente da loja (somente leitura): contato, endereços salvos, últimos pedidos e total gasto.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID do cliente." },
        email: { type: "string", description: "E-mail do cliente nesta loja." },
      },
    },
    handler: async (args, { tenant }) => {
      if (!args.id && !args.email) throw new Error("Informe o 'id' ou o 'email' do cliente.");
      const cliente = await prisma.comprador.findFirst({
        where: { tenantId: tenant.id, ...(args.id ? { id: args.id } : { email: String(args.email).toLowerCase() }) },
        include: {
          enderecos: true,
          pedidos: { orderBy: { criadoEm: "desc" }, take: 10, select: { id: true, referencia: true, status: true, totalCentavos: true, criadoEm: true } },
        },
      });
      if (!cliente) throw new Error("Cliente não encontrado nesta loja.");
      const pago = cliente.pedidos.filter((p) => ["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"].includes(p.status));
      return {
        id: cliente.id,
        nome: cliente.nome,
        email: cliente.email,
        telefone: cliente.telefone,
        documento: cliente.documento,
        desde: cliente.criadoEm.toISOString(),
        enderecos: cliente.enderecos.map((e) => ({ apelido: e.apelido, cep: e.cep, logradouro: e.logradouro, numero: e.numero, complemento: e.complemento, bairro: e.bairro, cidade: e.cidade, uf: e.uf, principal: e.principal })),
        ultimosPedidos: cliente.pedidos.map((p) => ({ id: p.id, referencia: p.referencia, status: p.status, total: formatarBRL(p.totalCentavos), data: p.criadoEm.toISOString() })),
        totalGastoPago: formatarBRL(pago.reduce((s, p) => s + p.totalCentavos, 0)),
      };
    },
  },

  // 18. Avaliações — listar
  {
    name: "listar_avaliacoes",
    description: "Lista avaliações de produtos da loja, com filtro por situação (pendentes, aprovadas ou todas).",
    inputSchema: {
      type: "object",
      properties: {
        situacao: { type: "string", enum: ["pendentes", "aprovadas", "todas"], description: "Padrão: pendentes." },
        limite: { type: "number", description: "Máximo de avaliações (padrão 20, teto 100)." },
      },
    },
    handler: async (args, { tenant }) => {
      const limite = Math.min(Number(args.limite) || 20, 100);
      const situacao = (args.situacao as string) ?? "pendentes";
      const avaliacoes = await prisma.avaliacao.findMany({
        where: {
          tenantId: tenant.id,
          ...(situacao === "aprovadas" ? { aprovada: true } : situacao === "pendentes" ? { aprovada: false } : {}),
        },
        include: { produto: { select: { nome: true, slug: true } } },
        orderBy: { criadoEm: "desc" },
        take: limite,
      });
      return {
        total: avaliacoes.length,
        avaliacoes: avaliacoes.map((a) => ({
          id: a.id,
          produto: a.produto.nome,
          autor: a.nome,
          nota: a.nota,
          texto: a.texto,
          aprovada: a.aprovada,
          data: a.criadoEm.toISOString(),
        })),
      };
    },
  },

  // 19. Avaliações — moderar
  {
    name: "moderar_avaliacao",
    description: "Aprova (publica na loja), reprova (oculta) ou exclui uma avaliação de produto.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID da avaliação." },
        acao: { type: "string", enum: ["aprovar", "reprovar", "excluir"], description: "O que fazer com a avaliação." },
      },
      required: ["id", "acao"],
    },
    handler: async (args, { tenant }) => {
      const av = await prisma.avaliacao.findFirst({ where: { id: args.id, tenantId: tenant.id } });
      if (!av) throw new Error("Avaliação não encontrada nesta loja.");
      if (args.acao === "excluir") {
        await prisma.avaliacao.delete({ where: { id: av.id } });
        return { sucesso: true, mensagem: "Avaliação excluída." };
      }
      const aprovada = args.acao === "aprovar";
      await prisma.avaliacao.update({ where: { id: av.id }, data: { aprovada } });
      return { sucesso: true, id: av.id, aprovada, mensagem: aprovada ? "Avaliação publicada na loja." : "Avaliação ocultada da loja." };
    },
  },

  // 20. Cupons — listar
  {
    name: "listar_cupons",
    description: "Lista os cupons de desconto da loja, com uso, limite, mínimo, validade e situação.",
    inputSchema: {
      type: "object",
      properties: { apenasAtivos: { type: "boolean", description: "Retornar só cupons ativos." } },
    },
    handler: async (args, { tenant }) => {
      const cupons = await prisma.cupom.findMany({
        where: { tenantId: tenant.id, ...(args.apenasAtivos ? { ativo: true } : {}) },
        orderBy: { criadoEm: "desc" },
      });
      return {
        total: cupons.length,
        cupons: cupons.map((c) => ({
          id: c.id,
          codigo: c.codigo,
          tipo: c.tipo,
          beneficio: c.tipo === "PERCENTUAL" ? `${c.valor}%` : c.tipo === "FIXO" ? formatarBRL(c.valor) : "Frete Grátis",
          minimo: c.minimoCentavos > 0 ? formatarBRL(c.minimoCentavos) : null,
          usos: c.usos,
          usosMax: c.usosMax,
          validoAte: c.validoAte?.toISOString() ?? null,
          ativo: c.ativo,
        })),
      };
    },
  },

  // 21. Cupons — atualizar / desativar / excluir
  {
    name: "atualizar_cupom",
    description: "Ativa, desativa, ajusta limite/mínimo/validade ou exclui um cupom existente.",
    inputSchema: {
      type: "object",
      properties: {
        codigo: { type: "string", description: "Código do cupom." },
        ativo: { type: "boolean", description: "Ligar ou desligar o cupom." },
        usosMax: { type: "number", description: "Novo limite de utilizações (0 remove o limite)." },
        minimoReais: { type: "number", description: "Novo valor mínimo do pedido em Reais." },
        validoAte: { type: "string", description: "Data de validade ISO (ex: 2026-12-31); string vazia remove a validade." },
        excluir: { type: "boolean", description: "Se true, exclui o cupom." },
      },
      required: ["codigo"],
    },
    handler: async (args, { tenant }) => {
      const codigo = String(args.codigo).trim().toUpperCase().replace(/\s+/g, "");
      const cupom = await prisma.cupom.findUnique({ where: { tenantId_codigo: { tenantId: tenant.id, codigo } } });
      if (!cupom) throw new Error("Cupom não encontrado nesta loja.");
      if (args.excluir) {
        await prisma.cupom.delete({ where: { id: cupom.id } });
        return { sucesso: true, mensagem: `Cupom ${codigo} excluído.` };
      }
      let validoAte: Date | null | undefined;
      if (args.validoAte !== undefined) {
        validoAte = args.validoAte ? new Date(args.validoAte) : null;
        if (validoAte && isNaN(validoAte.getTime())) throw new Error("Data de validade inválida. Use o formato ISO, ex: 2026-12-31.");
      }
      const atualizado = await prisma.cupom.update({
        where: { id: cupom.id },
        data: {
          ...(args.ativo !== undefined ? { ativo: Boolean(args.ativo) } : {}),
          ...(args.usosMax !== undefined ? { usosMax: Number(args.usosMax) > 0 ? Number(args.usosMax) : null } : {}),
          ...(args.minimoReais !== undefined ? { minimoCentavos: Math.round(Number(args.minimoReais) * 100) } : {}),
          ...(validoAte !== undefined ? { validoAte } : {}),
        },
      });
      return { sucesso: true, codigo: atualizado.codigo, ativo: atualizado.ativo, usosMax: atualizado.usosMax, validoAte: atualizado.validoAte?.toISOString() ?? null };
    },
  },

  // 22. Fotos do produto
  {
    name: "gerenciar_fotos_produto",
    description: "Adiciona, remove, reordena ou define a foto principal de um produto. A primeira imagem da galeria é a principal da vitrine.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID do produto." },
        acao: { type: "string", enum: ["adicionar", "remover", "definir_principal", "reordenar"], description: "Operação na galeria." },
        url: { type: "string", description: "URL de uma foto (para adicionar, remover ou definir_principal)." },
        urls: { type: "array", items: { type: "string" }, description: "Lista de URLs: várias para adicionar, ou a galeria inteira na nova ordem (reordenar)." },
      },
      required: ["id", "acao"],
    },
    handler: async (args, { tenant }) => {
      const p = await prisma.produto.findFirst({ where: { id: args.id, tenantId: tenant.id }, select: { imagens: true, nome: true } });
      if (!p) throw new Error("Produto não encontrado nesta loja.");
      const atual = [...p.imagens];
      const novas = Array.isArray(args.urls) ? (args.urls as unknown[]).map((u) => String(u).trim()).filter(Boolean) : [];
      const url = args.url ? String(args.url).trim() : "";
      let nova: string[];
      if (args.acao === "adicionar") {
        const add = url ? [url, ...novas] : novas;
        if (!add.length) throw new Error("Informe 'url' ou 'urls' para adicionar.");
        nova = [...atual, ...add.filter((u) => !atual.includes(u))];
      } else if (args.acao === "remover") {
        if (!url) throw new Error("Informe a 'url' da foto a remover.");
        nova = atual.filter((u) => u !== url);
      } else if (args.acao === "definir_principal") {
        if (!url || !atual.includes(url)) throw new Error("A 'url' precisa ser uma foto já existente no produto.");
        nova = [url, ...atual.filter((u) => u !== url)];
      } else {
        if (!novas.length) throw new Error("Informe 'urls' com a galeria na nova ordem.");
        nova = novas;
      }
      const atualizado = await salvarProdutoNoCatalogo(tenant.id, args.id, { imagens: nova }, { origem: "mcp" });
      invalidarCatalogo(tenant.id);
      return { sucesso: true, produto: p.nome, totalFotos: atualizado.imagens.length, fotoPrincipal: atualizado.imagens[0] ?? null, imagens: atualizado.imagens };
    },
  },

  // 23. Estoque — ajustar (produto sem variações)
  {
    name: "ajustar_estoque",
    description: "Define a quantidade em estoque de um produto sem variações. Produtos com variações são ajustados pela grade no painel.",
    inputSchema: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID do produto." },
        estoque: { type: "number", description: "Nova quantidade absoluta em estoque (0 ou mais)." },
        ilimitado: { type: "boolean", description: "Marca o produto como estoque não controlado (ilimitado)." },
      },
      required: ["id"],
    },
    handler: async (args, { tenant }) => {
      const p = await prisma.produto.findFirst({ where: { id: args.id, tenantId: tenant.id }, select: { nome: true } });
      if (!p) throw new Error("Produto não encontrado nesta loja.");
      if (args.estoque === undefined && !args.ilimitado) throw new Error("Informe 'estoque' (quantidade) ou 'ilimitado: true'.");
      const valor = args.ilimitado ? null : Math.max(0, Math.round(Number(args.estoque)));
      const atualizado = await salvarProdutoNoCatalogo(tenant.id, args.id, { estoque: valor }, { origem: "mcp" });
      invalidarCatalogo(tenant.id);
      return { sucesso: true, produto: p.nome, estoque: atualizado.estoque, disponibilidade: atualizado.disponibilidade };
    },
  },

  // 24. Estoque baixo
  {
    name: "listar_estoque_baixo",
    description: "Lista produtos ativos com estoque igual ou abaixo de um limite (padrão 5), para reposição.",
    inputSchema: {
      type: "object",
      properties: {
        limite: { type: "number", description: "Nível de alerta de estoque (padrão 5)." },
        max: { type: "number", description: "Máximo de produtos retornados (padrão 50, teto 200)." },
      },
    },
    handler: async (args, { tenant }) => {
      const limiar = args.limite !== undefined ? Math.max(0, Math.round(Number(args.limite))) : 5;
      const max = Math.min(Number(args.max) || 50, 200);
      const produtos = await prisma.produto.findMany({
        where: { tenantId: tenant.id, ativo: true, estoque: { not: null, lte: limiar } },
        orderBy: { estoque: "asc" },
        take: max,
        select: { id: true, nome: true, sku: true, estoque: true, slug: true },
      });
      return {
        limiar,
        total: produtos.length,
        produtos: produtos.map((p) => ({ id: p.id, nome: p.nome, sku: p.sku, estoque: p.estoque, linkLoja: `${urlDaLoja(tenant)}/produtos/${p.slug}` })),
      };
    },
  },

  // 25. Atribuição — de onde vêm as vendas
  {
    name: "resumo_atribuicao",
    description: "De onde vêm as vendas: sessões e faturamento pago por canal de origem (orgânico, pago, social, direto…) nos últimos N dias.",
    inputSchema: {
      type: "object",
      properties: { dias: { type: "number", description: "Janela em dias (padrão 30, teto 90)." } },
    },
    handler: async (args, { tenant }) => {
      const dias = Math.min(Math.max(Number(args.dias) || 30, 1), 90);
      const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
      const PAGOS: PedidoStatus[] = ["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"];
      const [sessoes, pedidos] = await Promise.all([
        prisma.sessaoVitrine.groupBy({ by: ["canal"], where: { tenantId: tenant.id, criadoEm: { gte: desde } }, _count: { _all: true } }),
        prisma.pedido.findMany({
          where: { tenantId: tenant.id, status: { in: PAGOS }, criadoEm: { gte: desde } },
          select: { totalCentavos: true, sessao: { select: { canal: true } } },
        }),
      ]);
      const porCanal = new Map<string, { pedidos: number; centavos: number }>();
      for (const p of pedidos) {
        const canal = p.sessao?.canal ?? "direto";
        const atualCanal = porCanal.get(canal) ?? { pedidos: 0, centavos: 0 };
        atualCanal.pedidos += 1;
        atualCanal.centavos += p.totalCentavos;
        porCanal.set(canal, atualCanal);
      }
      const sessoesPorCanal = new Map(sessoes.map((s) => [s.canal, s._count._all]));
      const canais = new Set<string>([...porCanal.keys(), ...sessoesPorCanal.keys()]);
      return {
        janelaDias: dias,
        canais: [...canais]
          .map((canal) => ({
            canal,
            sessoes: sessoesPorCanal.get(canal) ?? 0,
            pedidosPagos: porCanal.get(canal)?.pedidos ?? 0,
            faturamento: formatarBRL(porCanal.get(canal)?.centavos ?? 0),
          }))
          .sort((a, b) => b.pedidosPagos - a.pedidosPagos || b.sessoes - a.sessoes),
      };
    },
  },

  // 26. Marketing — funil, conversão, cupons e abandono
  {
    name: "resumo_marketing",
    description: "Visão de marketing dos últimos N dias: funil da vitrine (sessões → viram produto → iniciam checkout → compram), taxa de conversão, cupons mais usados e carrinhos abandonados.",
    inputSchema: {
      type: "object",
      properties: { dias: { type: "number", description: "Janela em dias (padrão 30, teto 90)." } },
    },
    handler: async (args, { tenant }) => {
      const dias = Math.min(Math.max(Number(args.dias) || 30, 1), 90);
      const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
      const PAGOS: PedidoStatus[] = ["PAGO", "EM_SEPARACAO", "ENVIADO", "ENTREGUE"];
      const [totalSessoes, viuProduto, iniciouCheckout, pedidosPagos, abandono, cupons] = await Promise.all([
        prisma.sessaoVitrine.count({ where: { tenantId: tenant.id, criadoEm: { gte: desde } } }),
        prisma.sessaoVitrine.count({ where: { tenantId: tenant.id, criadoEm: { gte: desde }, viuProduto: true } }),
        prisma.sessaoVitrine.count({ where: { tenantId: tenant.id, criadoEm: { gte: desde }, iniciouCheckout: true } }),
        prisma.pedido.count({ where: { tenantId: tenant.id, status: { in: PAGOS }, criadoEm: { gte: desde } } }),
        prisma.checkoutAberto.aggregate({ where: { tenantId: tenant.id, status: "ABERTO", criadoEm: { gte: desde } }, _count: { _all: true }, _sum: { totalCentavos: true } }),
        prisma.cupom.findMany({ where: { tenantId: tenant.id, usos: { gt: 0 } }, orderBy: { usos: "desc" }, take: 5, select: { codigo: true, usos: true, tipo: true, valor: true } }),
      ]);
      const conversao = totalSessoes > 0 ? Math.round((pedidosPagos / totalSessoes) * 1000) / 10 : null;
      return {
        janelaDias: dias,
        funil: { sessoes: totalSessoes, viramProduto: viuProduto, iniciaramCheckout: iniciouCheckout, compraram: pedidosPagos },
        taxaConversaoPercent: conversao,
        carrinhosAbandonados: { quantidade: abandono._count._all, valorEmAberto: formatarBRL(abandono._sum.totalCentavos ?? 0) },
        cuponsMaisUsados: cupons.map((c) => ({ codigo: c.codigo, usos: c.usos, beneficio: c.tipo === "PERCENTUAL" ? `${c.valor}%` : c.tipo === "FIXO" ? formatarBRL(c.valor) : "Frete Grátis" })),
      };
    },
  },
];
