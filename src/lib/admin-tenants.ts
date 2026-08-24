import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { cifrar } from "./cofre";
import { slugificar } from "./catalogo";
import { esquecerTenantEmCache } from "./tenant";
import type { ProdutoEntrada, TenantEntrada } from "./admin-schemas";

function dadosDoTenant(entrada: Partial<TenantEntrada>): Prisma.TenantUpdateInput {
  const { mercadoPago, tema, endereco, tabelaFrete, ...resto } = entrada;
  const dados: Prisma.TenantUpdateInput = { ...resto };
  if (tema) dados.tema = tema;
  if (endereco) dados.endereco = endereco;
  if (tabelaFrete) dados.tabelaFrete = tabelaFrete;
  if (mercadoPago) {
    dados.mpPublicKey = mercadoPago.publicKey;
    dados.mpAccessTokenEnc = cifrar(mercadoPago.accessToken);
    dados.mpWebhookSecretEnc = mercadoPago.webhookSecret ? cifrar(mercadoPago.webhookSecret) : null;
  }
  return dados;
}

export async function criarTenant(entrada: TenantEntrada) {
  const dados = dadosDoTenant(entrada);
  const dominios = new Set(entrada.dominios ?? []);
  if (entrada.dominioPrincipal) {
    const apex = entrada.dominioPrincipal.replace(/^www\./, "");
    dominios.add(apex);
    dominios.add(`www.${apex}`);
  }
  return prisma.tenant.create({
    data: { ...(dados as Prisma.TenantCreateInput), slug: entrada.slug, nome: entrada.nome, dominios: Array.from(dominios) },
  });
}

export async function atualizarTenant(slug: string, entrada: Partial<TenantEntrada> & { status?: "PROVISIONANDO" | "ATIVA" | "SUSPENSA" | "CANCELADA" }) {
  const { slug: _ignorado, ...resto } = entrada;
  void _ignorado;
  const t = await prisma.tenant.update({ where: { slug }, data: dadosDoTenant(resto) });
  esquecerTenantEmCache(slug);
  return t;
}

/**
 * Importa/atualiza produtos em lote. Chave de idempotência: `sku`, senão `slug`,
 * senão o slug do nome. Rodar duas vezes a mesma planilha não duplica nada.
 */
export async function importarProdutos(tenantId: string, produtos: ProdutoEntrada[]) {
  const categorias = new Map<string, string>();
  for (const c of await prisma.categoria.findMany({ where: { tenantId } })) categorias.set(c.slug, c.id);

  let criados = 0;
  let atualizados = 0;

  for (const p of produtos) {
    let categoriaId: string | null = null;
    if (p.categoria) {
      const cslug = slugificar(p.categoria);
      categoriaId = categorias.get(cslug) ?? null;
      if (!categoriaId) {
        const c = await prisma.categoria.create({ data: { tenantId, slug: cslug, nome: p.categoria, ordem: categorias.size } });
        categorias.set(cslug, c.id);
        categoriaId = c.id;
      }
    }

    const slug = p.slug ? slugificar(p.slug) : slugificar(p.nome);
    const { categoria: _c, ...campos } = p;
    void _c;
    const dados = { ...campos, slug, categoriaId, atributos: (p.atributos ?? {}) as Prisma.InputJsonValue };

    const existente = p.sku
      ? await prisma.produto.findFirst({ where: { tenantId, sku: p.sku } })
      : await prisma.produto.findUnique({ where: { tenantId_slug: { tenantId, slug } } });

    if (existente) {
      await prisma.produto.update({ where: { id: existente.id }, data: dados });
      atualizados++;
    } else {
      await prisma.produto.create({ data: { ...dados, tenantId } });
      criados++;
    }
  }

  return { criados, atualizados };
}
