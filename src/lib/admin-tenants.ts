import type { Prisma } from "@prisma/client";
import { prisma } from "./db";
import { cifrar } from "./cofre";
import { slugificar } from "./catalogo";
import { esquecerTenantEmCache } from "./tenant";
import type { ProdutoPlanilha, TenantEntrada } from "./admin-schemas";
import { invalidarCatalogo } from "./catalogo-cache";
import { salvarProdutoNoCatalogo } from "./catalogo-escrita";
import { ErroCampo, lerDefinicoes, normalizarValor } from "./campos-personalizados";

function dadosDoTenant(entrada: Partial<TenantEntrada>): Prisma.TenantUpdateInput {
  const { mercadoPago, tema, identidade, endereco, tabelaFrete, entregaLocal, ...resto } = entrada;
  const dados: Prisma.TenantUpdateInput = { ...resto };
  if (tema) dados.tema = tema;
  if (identidade) dados.identidade = identidade;
  if (endereco) dados.endereco = endereco;
  if (tabelaFrete) dados.tabelaFrete = tabelaFrete;
  if (entregaLocal) dados.entregaLocal = entregaLocal;
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
export async function importarProdutos(tenantId: string, produtos: ProdutoPlanilha[]) {
  const categorias = new Map<string, string | null>();
  const registrarChaveCategoria = (chave: string, id: string) => {
    if (!categorias.has(chave)) categorias.set(chave, id);
    else if (categorias.get(chave) !== id) categorias.set(chave, null);
  };
  for (const c of await prisma.categoria.findMany({ where: { tenantId } })) {
    registrarChaveCategoria(c.slug, c.id);
    registrarChaveCategoria(slugificar(c.nome), c.id);
  }
  const nomesCorrigidos = new Set<string>();

  // As definições de campo da loja, uma vez por lote: é por elas que um valor
  // de planilha vira número, data ou opção válida.
  const definicoes = lerDefinicoes(
    (await prisma.tenant.findUnique({ where: { id: tenantId }, select: { camposPersonalizados: true } }))?.camposPersonalizados,
  );

  let criados = 0;
  let atualizados = 0;
  /** Célula recusada: a importação segue, e o painel mostra o que ficou de fora. */
  const avisos: string[] = [];

  for (const p of produtos) {
    const desejado = p.slug ? slugificar(p.slug) : p.nome ? slugificar(p.nome) : null;
    // `findUnique` desde que (tenantId, sku) virou único: o `findFirst` de
    // antes não tinha `orderBy`, então com SKU repetido a planilha atualizava
    // um produto ao acaso e o outro parava no tempo.
    let existente = p.sku
      ? await prisma.produto.findUnique({ where: { tenantId_sku: { tenantId, sku: p.sku } } })
      : null;
    if (!existente && desejado) {
      existente = await prisma.produto.findUnique({ where: { tenantId_slug: { tenantId, slug: desejado } } });
    }
    if (!existente && (!p.nome?.trim() || p.precoCentavos === undefined)) {
      avisos.push(`${p.sku ?? p.slug ?? "Linha sem identificação"}: SKU não encontrado; um produto novo exige nome e preço.`);
      continue;
    }
    if (p.imagemOrigem && p.imagemOrigem !== "propria" && !(p.imagens?.length || existente?.imagens.length)) {
      avisos.push(`${p.sku ?? p.nome ?? "Produto"}: informe a imagem antes de classificar sua origem.`);
      continue;
    }
    if ((p.confirmarImagemExata || p.correspondenciaImagem) && ((p.imagemOrigem ?? existente?.imagemOrigem ?? "propria") !== "propria" || !((p.imagens?.length ?? 0) || (existente?.imagens.length ?? 0)))) {
      avisos.push(`${p.sku ?? p.nome ?? "Produto"}: classificação da correspondência exige foto principal e origem própria.`);
      continue;
    }

    let categoriaId: string | null = null;
    if (p.categoria) {
      const cslug = slugificar(p.categoria);
      const categoriaConhecida = categorias.has(cslug);
      categoriaId = categorias.get(cslug) ?? null;
      if (categoriaConhecida && !categoriaId) {
        avisos.push(`${p.sku ?? p.nome ?? "Produto"}: nome de categoria ambíguo; a categoria atual foi preservada.`);
      } else if (!categoriaConhecida) {
        const categoriasUnicas = new Set([...categorias.values()].filter((id): id is string => Boolean(id)));
        const c = await prisma.categoria.create({ data: { tenantId, slug: cslug, nome: p.categoria, ordem: categoriasUnicas.size } });
        registrarChaveCategoria(cslug, c.id);
        registrarChaveCategoria(slugificar(c.nome), c.id);
        categoriaId = c.id;
      } else if (categoriaId && !nomesCorrigidos.has(cslug)) {
        // O slug ignora acento, então "Eletrica" e "Elétrica" são a mesma
        // categoria — mas o nome exibido continuava o da primeira importação.
        // Corrigir a planilha não corrigia a vitrine, e o menu ficava com o
        // erro de português à vista. Uma vez por lote, não por produto.
        nomesCorrigidos.add(cslug);
        await prisma.categoria.updateMany({ where: { id: categoriaId, nome: { not: p.categoria } }, data: { nome: p.categoria } });
      }
    }

    const { categoria: _c, compatibilidade, atributos, camposPersonalizados, confirmarImagemExata, correspondenciaImagem, ...campos } = p;
    void _c;
    const slug = await slugLivre(tenantId, desejado ?? existente!.slug, existente?.id ?? null);

    /**
     * Uma célula ruim não derruba a planilha inteira.
     *
     * Importação de 2.000 linhas que para na 1.700ª porque alguém escreveu
     * "doze" num campo numérico deixa o lojista com o catálogo pela metade e
     * sem saber onde parou. Aqui a linha entra sem aquele campo e o problema
     * volta como aviso, junto do resultado.
     */
    let valoresCampos: Record<string, string> | undefined;
    if (camposPersonalizados && definicoes.length) {
      valoresCampos = {};
      for (const campo of definicoes) {
        if (!(campo.chave in camposPersonalizados)) continue;
        try {
          const valor = normalizarValor(campo, camposPersonalizados[campo.chave]);
          if (valor !== null) valoresCampos[campo.chave] = valor;
        } catch (e) {
          if (!(e instanceof ErroCampo)) throw e;
          avisos.push(`${p.nome}: ${e.message}`);
        }
      }
    }

    const dados = {
      ...campos,
      slug,
      // Sem `categoria` na entrada, a categoria atual fica como está. Escrever
      // null aqui tirava da prateleira todo produto de uma carga que só queria
      // atualizar preço ou foto: aconteceu com 872 retentores em 02/09/2026,
      // que sumiram do menu sem erro nenhum aparecer.
      ...(p.categoria && categoriaId ? { categoriaId } : {}),
      ...(atributos !== undefined ? { atributos: atributos as Prisma.InputJsonValue } : {}),
      ...(compatibilidade ? { compatibilidade: compatibilidade as unknown as Prisma.InputJsonValue } : {}),
      ...(valoresCampos ? { camposPersonalizados: valoresCampos as unknown as Prisma.InputJsonValue } : {}),
    };

    if (existente) {
      const correspondencia = confirmarImagemExata ? "confirmada" : correspondenciaImagem;
      await salvarProdutoNoCatalogo(tenantId, existente.id, dados, { origem: "importacao", ...(correspondencia ? { metadadosMidia: { fonte: "planilha", correspondencia, somentePrincipal: true } } : {}) });
      atualizados++;
    } else {
      const correspondencia = confirmarImagemExata ? "confirmada" : correspondenciaImagem;
      await salvarProdutoNoCatalogo(tenantId, null, dados, { origem: "importacao", ...(correspondencia ? { metadadosMidia: { fonte: "planilha", correspondencia, somentePrincipal: true } } : {}) });
      criados++;
    }
  }
  // A planilha mudou o catálogo: as faixas de medida e as motos guardadas
  // por loja caem agora, não daqui a cinco minutos.
  invalidarCatalogo(tenantId);

  return { criados, atualizados, ...(avisos.length ? { avisosTotal: avisos.length, avisos: avisos.slice(0, 50) } : {}) };
}
