import { z } from "zod";
import { prisma } from "@/lib/db";
import { slugificar, formatarBRL } from "@/lib/catalogo";
import { emitirEtiqueta } from "@/lib/postagem";
import { urlDaLoja, temaDo } from "@/lib/tenant";
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
    description: "Atualiza o layout da loja (dentre os 7 modelos: spotlight, mercado, conversao, classico, vitrine, editorial, minimal), cores, slogan, modo e avisos.",
    inputSchema: {
      type: "object",
      properties: {
        layout: {
          type: "string",
          enum: ["spotlight", "mercado", "distribuidora", "automotivo", "conversao", "classico", "vitrine", "editorial", "minimal"],
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
      const temaAtual = temaDo(tenant);
      const novoTema = {
        ...temaAtual,
        ...(args.layout ? { layout: args.layout } : {}),
        ...(args.corPrimaria ? { corPrimaria: args.corPrimaria } : {}),
        ...(args.modo ? { modo: args.modo } : {}),
        ...(args.fonte ? { fonte: args.fonte } : {}),
      };

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
        imagens: { type: "array", items: { type: "string" }, description: "Lista de URLs de imagens." },
      },
      required: ["id"],
    },
    handler: async (args, { tenant }) => {
      const p = await prisma.produto.findFirst({
        where: { id: args.id, tenantId: tenant.id },
      });
      if (!p) throw new Error("Produto não encontrado nesta loja.");

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
];
