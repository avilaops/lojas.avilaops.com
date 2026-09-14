import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { cifrar } from "./cofre";
import { slugificar } from "./catalogo";
import { esquecerTenantEmCache } from "./tenant";
import type { ProdutoEntrada, TenantEntrada } from "./admin-schemas";
import { invalidarCatalogo } from "./catalogo-cache";
import { salvarProdutoNoCatalogo } from "./catalogo-escrita";

function dadosDoTenant(entrada: Partial<TenantEntrada>): Prisma.TenantUpdateInput {
  const { mercadoPago, tema, identidade, endereco, tabelaFrete, ...resto } = entrada;
  const dados: Prisma.TenantUpdateInput = { ...resto };
  if (tema) dados.tema = tema;
  if (identidade) dados.identidade = identidade;
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
  // Tema é JSON: um PATCH parcial ({ tema: { layout } }) não pode apagar a cor.
  const dados = dadosDoTenant(resto);
  if (resto.tema) {
    const atual = await prisma.tenant.findUniqueOrThrow({ where: { slug }, select: { tema: true } });
    dados.tema = { ...((atual.tema as Record<string, unknown>) ?? {}), ...resto.tema };
  }
  if (resto.identidade) {
    const atual = await prisma.tenant.findUniqueOrThrow({ where: { slug }, select: { identidade: true } });
    dados.identidade = { ...((atual.identidade as Record<string, unknown>) ?? {}), ...resto.identidade };
  }
  // Definir o domínio principal tem que incluí-lo em `dominios`, que é a lista
  // que o Caddy lê para emitir certificado (GET /api/admin/dominios). Na
  // criação isso já acontecia; no PATCH não, então quem cadastrava o domínio
  // depois — o caso normal, o domínio chega semanas depois da loja — ficava com
  // o campo preenchido, nenhum erro à vista e o site sem responder pelo domínio.
  if (resto.dominioPrincipal && resto.dominios === undefined) {
    const apex = resto.dominioPrincipal.replace(/^www\./, "");
    const atual = await prisma.tenant.findUniqueOrThrow({ where: { slug }, select: { dominios: true } });
    dados.dominios = Array.from(new Set([...atual.dominios, apex, `www.${apex}`]));
  }
  const t = await prisma.tenant.update({ where: { slug }, data: dados });
  esquecerTenantEmCache(slug);
  return t;
}

/**
 * Primeiro slug livre a partir do desejado: `-2`, `-3`… O `donoAtual` é o
 * produto que está sendo gravado, se já existir — ele pode ficar com o slug
 * que já é dele, senão toda reimportação renomearia tudo.
 *
 * Existe porque o slug sai do nome e nome repetido é comum: duas peças
 * diferentes podem se chamar "Rolamento 6204 2RS". E reimportar uma planilha
 * com nomes corrigidos também colide, porque o slug novo de um produto pode
 * ser o slug atual de outro. Sem desviar, o lote inteiro morre com P2002.
 */
export async function slugLivre(
  tenantId: string,
  desejado: string,
  donoAtual: string | null,
  buscarDono: (slug: string) => Promise<{ id: string } | null> = (slug) =>
    prisma.produto.findUnique({ where: { tenantId_slug: { tenantId, slug } }, select: { id: true } }),
): Promise<string> {
  for (let n = 1; ; n++) {
    const slug = n === 1 ? desejado : `${desejado}-${n}`;
    const dono = await buscarDono(slug);
    if (!dono || dono.id === donoAtual) return slug;
  }
}

/**
 * Importa/atualiza produtos em lote. Chave de idempotência: `sku`, senão `slug`,
 * senão o slug do nome. Rodar duas vezes a mesma planilha não duplica nada.
 *
 * O endereço da página (`slug`) é derivado, não é a chave: quando o slug
 * desejado já é de outro produto, ganha um sufixo em vez de derrubar o lote.
 */
export async function importarProdutos(tenantId: string, produtos: ProdutoEntrada[]) {
  const categorias = new Map<string, string>();
  for (const c of await prisma.categoria.findMany({ where: { tenantId } })) categorias.set(c.slug, c.id);
  const nomesCorrigidos = new Set<string>();

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
      } else if (!nomesCorrigidos.has(cslug)) {
        // O slug ignora acento, então "Eletrica" e "Elétrica" são a mesma
        // categoria — mas o nome exibido continuava o da primeira importação.
        // Corrigir a planilha não corrigia a vitrine, e o menu ficava com o
        // erro de português à vista. Uma vez por lote, não por produto.
        nomesCorrigidos.add(cslug);
        await prisma.categoria.updateMany({ where: { id: categoriaId, nome: { not: p.categoria } }, data: { nome: p.categoria } });
      }
    }

    const desejado = p.slug ? slugificar(p.slug) : slugificar(p.nome);
    const { categoria: _c, compatibilidade, atributos, ...campos } = p;
    void _c;
    const existente = p.sku
      ? await prisma.produto.findFirst({ where: { tenantId, sku: p.sku } })
      : await prisma.produto.findUnique({ where: { tenantId_slug: { tenantId, slug: desejado } } });

    const slug = await slugLivre(tenantId, desejado, existente?.id ?? null);

    const dados = {
      ...campos,
      slug,
      // Sem `categoria` na entrada, a categoria atual fica como está. Escrever
      // null aqui tirava da prateleira todo produto de uma carga que só queria
      // atualizar preço ou foto: aconteceu com 872 retentores em 02/09/2026,
      // que sumiram do menu sem erro nenhum aparecer.
      ...(p.categoria ? { categoriaId } : {}),
      ...(atributos !== undefined ? { atributos: atributos as Prisma.InputJsonValue } : {}),
      ...(compatibilidade ? { compatibilidade: compatibilidade as unknown as Prisma.InputJsonValue } : {}),
    };

    if (existente) {
      await salvarProdutoNoCatalogo(tenantId, existente.id, dados, { origem: "importacao" });
      atualizados++;
    } else {
      await salvarProdutoNoCatalogo(tenantId, null, dados, { origem: "importacao" });
      criados++;
    }
  }
  // A planilha mudou o catálogo: as faixas de medida e as motos guardadas
  // por loja caem agora, não daqui a cinco minutos.
  invalidarCatalogo(tenantId);

  return { criados, atualizados };
}
