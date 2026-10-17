import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { ErroApi } from "@/lib/api-resposta";
import { editarProdutoPelaApi } from "@/lib/api-produtos";
import { invalidarCatalogo } from "@/lib/catalogo-cache";
import { ajustarOfertaNoCatalogo } from "@/lib/catalogo-escrita";
import { ErroCatalogo } from "@/lib/catalogo-oferta";
import { origemDaAvilaOps } from "@/lib/catalogo-origem";
import { linhaDoProduto } from "@/lib/catalogo-admin-consulta";
import { EdicaoPeloAdmin } from "./editar";

type Ctx = { params: Promise<{ slug: string; id: string }> };

/**
 * GET — um produto da loja, com o histórico das últimas alterações.
 *
 * Para o painel da Ávila Ops abrir a ficha sem carregar o catálogo inteiro. O
 * histórico vem de `HistoricoCatalogo`, que a própria plataforma grava a cada
 * mudança (origem, campos, antes e depois): é leitura, este endpoint não
 * altera nada. A busca é sempre por loja E id — id de produto de outra loja
 * devolve 404, não o produto.
 */
export async function GET(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug, id } = await params;
  const t = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });

  const produto = await prisma.produto.findFirst({
    where: { tenantId: t.id, id },
    include: { categoria: { select: { nome: true, slug: true } } },
  });
  if (!produto) return Response.json({ erro: "produto não encontrado" }, { status: 404 });

  const historico = await prisma.historicoCatalogo.findMany({
    where: { tenantId: t.id, produtoId: produto.id },
    orderBy: { versao: "desc" },
    take: 20,
    select: { versao: true, origem: true, campos: true, antes: true, depois: true, criadoEm: true },
  });

  // `antes` e `depois` guardam o produto INTEIRO a cada versão (texto de busca,
  // mídias, atributos). Para a ficha interessa o que mudou: só os campos
  // listados em `campos` saem daqui.
  const so = (retrato: unknown, campos: string[]) => {
    const origem = retrato && typeof retrato === "object" ? (retrato as Record<string, unknown>) : {};
    return Object.fromEntries(campos.map((campo) => [campo, origem[campo] ?? null]));
  };

  const [resumo, categorias] = await Promise.all([
    // Estoque oficial (das variações) e estado, calculados como na lista.
    linhaDoProduto(t.id, produto.id),
    // Todas as categorias da loja, inclusive as vazias: é a lista de onde se escolhe.
    prisma.categoria.findMany({ where: { tenantId: t.id }, select: { slug: true, nome: true }, orderBy: { nome: "asc" } }),
  ]);

  return Response.json({
    produto,
    resumo,
    categorias,
    historico: historico.map((h) => ({
      versao: h.versao,
      origem: h.origem,
      campos: h.campos,
      criadoEm: h.criadoEm,
      antes: so(h.antes, h.campos),
      depois: so(h.depois, h.campos),
    })),
  });
}

/**
 * PATCH — o painel da Ávila Ops altera situação, categoria e preço de um produto.
 *
 * Não há escrita própria aqui: situação e categoria vão por
 * `editarProdutoPelaApi` e preço por `ajustarOfertaNoCatalogo`, os mesmos
 * trilhos do painel da loja e do ERP — trava do produto, projeção, evento e
 * `HistoricoCatalogo` na mesma transação. Alteração concluída sem registro não
 * existe por construção, e o registro leva quem alterou (`avilaops:<autor>`).
 *
 * Estoque fica de fora de propósito: é o ERP ou o lojista quem conta a
 * prateleira, e um terceiro caminho para o mesmo número é como eles passam a
 * brigar.
 *
 * Preço vem primeiro e é quem confere a versão; a parte editorial vem depois,
 * sobre a versão que o preço acabou de gravar. Se a editorial falhar, o preço
 * fica gravado e a resposta diz o que entrou (`gravados`) e o que não.
 */
export async function PATCH(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug, id } = await params;

  const r = EdicaoPeloAdmin.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "dados inválidos", detalhes: r.error.flatten() }, { status: 422 });
  const { autor, versao, ativo, categoria, precoCentavos, precoDeCentavos } = r.data;

  const t = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  const produto = await prisma.produto.findFirst({ where: { tenantId: t.id, id }, select: { id: true } });
  if (!produto) return Response.json({ erro: "produto não encontrado" }, { status: 404 });

  const origem = origemDaAvilaOps(autor);
  const gravados: string[] = [];
  let versaoAtual = versao;

  const recusar = (erro: unknown) => {
    const status = erro instanceof ErroApi ? erro.status : erro instanceof ErroCatalogo ? erro.status : 500;
    if (status === 500) console.error(`[admin/produtos] ${slug}/${id}`, erro);
    const mensagem = erro instanceof ErroApi || erro instanceof ErroCatalogo ? erro.message : "não foi possível gravar";
    return Response.json({ erro: mensagem, gravados }, { status });
  };

  if (precoCentavos !== undefined || precoDeCentavos !== undefined) {
    const padrao = await prisma.variante.findFirst({ where: { tenantId: t.id, produtoId: produto.id, padrao: true, ativo: true }, select: { id: true } });
    const temGrade = await prisma.variante.count({ where: { tenantId: t.id, produtoId: produto.id, padrao: false, ativo: true } });
    if (!padrao || temGrade > 0) {
      return Response.json({ erro: "Este produto tem variações: o preço é de cada variação e se edita na grade, no painel da loja.", gravados }, { status: 409 });
    }
    try {
      const ajuste = await ajustarOfertaNoCatalogo(
        t.id,
        padrao.id,
        { ...(precoCentavos !== undefined ? { precoCentavos } : {}), ...(precoDeCentavos !== undefined ? { precoDeCentavos } : {}) },
        origem,
        undefined,
        versao,
      );
      if (ajuste.mudou) {
        versaoAtual = ajuste.versao;
        if (precoCentavos !== undefined) gravados.push("precoCentavos");
        if (precoDeCentavos !== undefined) gravados.push("precoDeCentavos");
      }
    } catch (erro) {
      return recusar(erro);
    }
  }

  if (ativo !== undefined || categoria !== undefined) {
    try {
      await editarProdutoPelaApi(
        t.id,
        produto.id,
        { ...(ativo !== undefined ? { ativo } : {}), ...(categoria !== undefined ? { categoria } : {}) },
        origem,
        versaoAtual,
      );
      if (ativo !== undefined) gravados.push("ativo");
      if (categoria !== undefined) gravados.push("categoria");
    } catch (erro) {
      return recusar(erro);
    }
  }

  try {
    invalidarCatalogo(t.id);
  } catch (erro) {
    console.error(`[admin/produtos] cache da loja ${slug} não foi limpo`, erro);
  }

  const depois = await prisma.produto.findUniqueOrThrow({
    where: { id: produto.id },
    select: { id: true, ativo: true, precoCentavos: true, precoDeCentavos: true, versaoCatalogo: true, categoria: { select: { nome: true, slug: true } } },
  });
  return Response.json({ produto: depois, gravados });
}
