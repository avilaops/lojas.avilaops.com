import { prisma } from "./db";
import { TenantAtualizacaoSchema, TenantEntradaSchema } from "./admin-schemas";
import { atualizarTenant, criarTenant } from "./admin-tenants";
import { anunciarLojaCriada, provisionarLoja } from "./provisionar";
import { urlDaLoja } from "./tenant";
import { MCP_TOOLS } from "./mcp-tools";
import { registrarChamada } from "./mcp-historico";

interface AdminMcpTool {
  name: string;
  title: string;
  description: string;
  readOnly: boolean;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}

function dadosPublicos<T extends Record<string, unknown>>(tenant: T) {
  return Object.fromEntries(Object.entries(tenant).filter(([campo]) => !campo.endsWith("Enc") && campo !== "apiKeyHash"));
}

const planos = ["SITE", "LOJA", "LOJA_PRO"] as const;
const estados = ["PROVISIONANDO", "ATIVA", "SUSPENSA", "CANCELADA"] as const;
const TenantMcpCriacaoSchema = TenantEntradaSchema.pick({
  slug: true,
  nome: true,
  plano: true,
  dominioPrincipal: true,
  segmento: true,
  emailContato: true,
  whatsapp: true,
});
const TenantMcpAtualizacaoSchema = TenantAtualizacaoSchema.pick({
  nome: true,
  plano: true,
  status: true,
  dominioPrincipal: true,
  emailContato: true,
  whatsapp: true,
});

export async function executarFerramentaNoTenant(
  tenantSlug: string,
  ferramenta: string,
  argumentos: Record<string, unknown>,
) {
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) throw new Error("Tenant não encontrado.");
  const tool = MCP_TOOLS.find((item) => item.name === ferramenta);
  if (!tool) throw new Error("Ferramenta da loja não encontrada.");
  const inicio = performance.now();
  const registrar = (ok: boolean) => registrarChamada({
    tenantId: tenant.id,
    origem: { tipo: "chave-antiga", id: "admin", nome: "Admin MCP Ávila Ops" },
    ferramenta: tool.name,
    args: argumentos,
    ok,
    duracaoMs: performance.now() - inicio,
  });
  try {
    const resultado = await tool.handler(argumentos, { tenant, isAdmin: true });
    await registrar(true);
    return resultado;
  } catch (erro) {
    await registrar(false);
    throw erro;
  }
}

export const MCP_ADMIN_TOOLS: AdminMcpTool[] = [
  {
    name: "admin_listar_tenants",
    title: "Listar lojas da plataforma",
    description: "Lista os tenants da plataforma com plano, situação, domínio e totais. Não retorna credenciais nem segredos.",
    readOnly: true,
    inputSchema: {
      type: "object",
      properties: {
        busca: { type: "string", description: "Parte do slug, nome ou domínio." },
        status: { type: "string", enum: estados, description: "Filtrar por situação." },
        limite: { type: "number", description: "Máximo de resultados, de 1 a 200. Padrão: 50." },
      },
    },
    handler: async (args) => {
      const busca = typeof args.busca === "string" ? args.busca.trim() : "";
      const status = typeof args.status === "string" && estados.includes(args.status as typeof estados[number])
        ? args.status as typeof estados[number]
        : undefined;
      const limite = Math.min(Math.max(Number(args.limite) || 50, 1), 200);
      const tenants = await prisma.tenant.findMany({
        where: {
          ...(status ? { status } : {}),
          ...(busca ? { OR: [
            { slug: { contains: busca, mode: "insensitive" } },
            { nome: { contains: busca, mode: "insensitive" } },
            { dominioPrincipal: { contains: busca, mode: "insensitive" } },
          ] } : {}),
        },
        select: {
          slug: true, nome: true, plano: true, status: true, dominioPrincipal: true,
          criadoEm: true, atualizadoEm: true,
          _count: { select: { produtos: true, pedidos: true, categorias: true } },
        },
        orderBy: { criadoEm: "desc" },
        take: limite,
      });
      return { total: tenants.length, tenants };
    },
  },
  {
    name: "admin_obter_tenant",
    title: "Ver tenant",
    description: "Obtém o cadastro administrativo de um tenant pelo slug, removendo todos os campos cifrados e segredos.",
    readOnly: true,
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "Slug exato da loja." } },
      required: ["slug"],
    },
    handler: async (args) => {
      const slug = String(args.slug ?? "").trim();
      const tenant = await prisma.tenant.findUnique({
        where: { slug },
        include: { _count: { select: { produtos: true, pedidos: true, categorias: true } } },
      });
      if (!tenant) throw new Error("Tenant não encontrado.");
      return dadosPublicos(tenant as unknown as Record<string, unknown>);
    },
  },
  {
    name: "admin_criar_tenant",
    title: "Criar tenant",
    description: "Cria uma loja isolada na plataforma. Provisionamento de DNS, e-mail e automações só ocorre quando provisionar=true.",
    readOnly: false,
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Identificador com letras minúsculas, números e hífens." },
        nome: { type: "string", description: "Nome público da loja." },
        plano: { type: "string", enum: planos, description: "Plano inicial. Padrão: LOJA." },
        dominioPrincipal: { type: "string", description: "Domínio próprio sem www." },
        segmento: { type: "string", enum: ["geral", "motopecas", "farmacia"], description: "Segmento da loja." },
        emailContato: { type: "string", description: "E-mail público de contato." },
        whatsapp: { type: "string", description: "WhatsApp com DDD ou DDI." },
        provisionar: { type: "boolean", description: "Executa DNS, e-mail e automações após criar. Padrão: false." },
      },
      required: ["slug", "nome"],
    },
    handler: async (args) => {
      const { provisionar, ...entrada } = args;
      const validacao = TenantMcpCriacaoSchema.strict().safeParse(entrada);
      if (!validacao.success) throw new Error(`Dados inválidos: ${validacao.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      if (await prisma.tenant.findUnique({ where: { slug: validacao.data.slug } })) throw new Error(`Já existe tenant com slug ${validacao.data.slug}.`);
      const tenant = await criarTenant(validacao.data);
      await anunciarLojaCriada(tenant);
      const passos = provisionar === true ? await provisionarLoja(tenant.slug) : undefined;
      return { slug: tenant.slug, nome: tenant.nome, url: urlDaLoja(tenant), status: tenant.status, ...(passos ? { provisionamento: passos } : {}) };
    },
  },
  {
    name: "admin_atualizar_tenant",
    title: "Alterar tenant",
    description: "Altera dados administrativos de um tenant existente. Não aceita nem retorna credenciais cifradas.",
    readOnly: false,
    inputSchema: {
      type: "object",
      properties: {
        slug: { type: "string", description: "Slug exato do tenant a alterar." },
        nome: { type: "string", description: "Novo nome público." },
        plano: { type: "string", enum: planos, description: "Novo plano." },
        status: { type: "string", enum: estados, description: "Nova situação." },
        dominioPrincipal: { type: "string", description: "Novo domínio principal." },
        emailContato: { type: "string", description: "Novo e-mail de contato." },
        whatsapp: { type: "string", description: "Novo WhatsApp." },
      },
      required: ["slug"],
    },
    handler: async (args) => {
      const slug = String(args.slug ?? "").trim();
      const { slug: _slug, ...entrada } = args;
      void _slug;
      const validacao = TenantMcpAtualizacaoSchema.strict().safeParse(entrada);
      if (!validacao.success) throw new Error(`Dados inválidos: ${validacao.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
      if (!await prisma.tenant.findUnique({ where: { slug }, select: { id: true } })) throw new Error("Tenant não encontrado.");
      const tenant = await atualizarTenant(slug, validacao.data);
      return { slug: tenant.slug, nome: tenant.nome, plano: tenant.plano, status: tenant.status, dominioPrincipal: tenant.dominioPrincipal, atualizadoEm: tenant.atualizadoEm };
    },
  },
  {
    name: "admin_provisionar_tenant",
    title: "Provisionar tenant",
    description: "Executa ou repete o provisionamento idempotente de DNS, e-mail e automações de uma loja existente.",
    readOnly: false,
    inputSchema: {
      type: "object",
      properties: { slug: { type: "string", description: "Slug exato do tenant." } },
      required: ["slug"],
    },
    handler: async (args) => provisionarLoja(String(args.slug ?? "").trim()),
  },
  {
    name: "admin_executar_no_tenant",
    title: "Operar uma loja como administrador",
    description: "Executa uma ferramenta lojas_* existente no tenant informado. Use admin_listar_tenants para confirmar o slug antes. O isolamento é conferido no servidor.",
    readOnly: false,
    inputSchema: {
      type: "object",
      properties: {
        tenantSlug: { type: "string", description: "Slug exato do tenant autorizado." },
        ferramenta: { type: "string", enum: MCP_TOOLS.map((tool) => tool.name), description: "Nome da ferramenta da loja." },
        argumentos: { type: "object", description: "Argumentos definidos no schema da ferramenta escolhida." },
      },
      required: ["tenantSlug", "ferramenta", "argumentos"],
    },
    handler: async (args) => {
      const tenantSlug = String(args.tenantSlug ?? "").trim();
      const ferramenta = String(args.ferramenta ?? "").trim();
      const argumentos = args.argumentos && typeof args.argumentos === "object" && !Array.isArray(args.argumentos)
        ? args.argumentos as Record<string, unknown>
        : {};
      return executarFerramentaNoTenant(tenantSlug, ferramenta, argumentos);
    },
  },
];

