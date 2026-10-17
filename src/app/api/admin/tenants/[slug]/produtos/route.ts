import { z } from "zod";
import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { ProdutoImportadoSchema } from "@/lib/admin-schemas";
import { importarProdutos } from "@/lib/admin-tenants";
import { importarImagemDeUrl } from "@/lib/uploads";
import { avisarERegistrar } from "@/lib/indexnow";

const BASE = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const t = await prisma.tenant.findUnique({ where: { slug } });
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  // `?resumo=1`: a lista que o painel da Ávila Ops usa para navegar o catálogo.
  // A resposta completa leva descrição, atributos e todas as imagens de cada
  // produto — 16 MB e quase 2 s para as 5.634 peças da Vedashow, a cada clique
  // de filtro. A enxuta leva só o que uma linha de tabela mostra.
  if (new URL(request.url).searchParams.get("resumo") === "1") {
    const linhas = await prisma.produto.findMany({
      where: { tenantId: t.id },
      select: {
        id: true, slug: true, nome: true, marca: true, sku: true,
        precoCentavos: true, precoDeCentavos: true,
        imagens: true, imagemOrigem: true,
        destaque: true, ativo: true, disponibilidade: true, estoque: true,
        atualizadoEm: true, criadoEm: true,
        categoria: { select: { nome: true, slug: true } },
      },
      orderBy: { nome: "asc" },
    });
    return Response.json(
      linhas.map(({ imagens, ...resto }) => ({
        ...resto,
        // Só a capa e a contagem: "sem foto" é `fotos === 0`, a mesma regra
        // de sempre, sem carregar as URLs de todas as fotos.
        imagem: imagens[0] ?? null,
        fotos: imagens.length,
      })),
    );
  }
  return Response.json(await prisma.produto.findMany({ where: { tenantId: t.id }, include: { categoria: true }, orderBy: { nome: "asc" } }));
}

/**
 * PUT — importa/atualiza produtos em lote (a "planilha" do onboarding).
 * Corpo: ProdutoEntrada[]. Idempotente por sku/slug.
 *
 * `?importarImagens=1` baixa as fotos externas para o nosso /uploads (a loja
 * deixa de depender do site de origem); `&tratar=1` passa cada uma pelo
 * removedor de fundo. Foto que falhar fica com a URL original: a importação
 * não para por causa de uma imagem.
 */
export async function PUT(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const t = await prisma.tenant.findUnique({ where: { slug } });
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });

  const r = z.array(ProdutoImportadoSchema).min(1).max(2000).safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "dados inválidos", detalhes: r.error.flatten() }, { status: 422 });

  const q = new URL(request.url).searchParams;
  const imagens = { importadas: 0, tratadas: 0, falhas: [] as string[] };
  if (q.get("importarImagens") === "1") {
    const tratar = q.get("tratar") === "1";
    for (const p of r.data) {
      if (!p.imagens?.length) continue;
      const novas: string[] = [];
      for (const u of p.imagens) {
        if (u.startsWith(`https://${BASE}/uploads/`)) {
          novas.push(u);
          continue;
        }
        try {
          const i = await importarImagemDeUrl(slug, u, tratar);
          novas.push(i.url);
          imagens.importadas++;
          if (i.tratada) imagens.tratadas++;
        } catch (erro) {
          imagens.falhas.push(`${p.nome}: ${erro instanceof Error ? erro.message : String(erro)}`);
          novas.push(u);
        }
      }
      p.imagens = novas;
    }
  }

  const resultado = await importarProdutos(t.id, r.data);
  // Importação em lote e sincronização do ERP entram por aqui, e não avisavam
  // ninguém: só a edição pelo painel avisava. Vai sem esperar a resposta, para
  // o lote não ficar preso a um buscador lento.
  const slugs = r.data.map((p) => p.slug).filter((s): s is string => Boolean(s));
  if (slugs.length) void avisarERegistrar(t, ["/produtos", ...slugs.map((s) => `/produtos/${s}`)]).catch(() => undefined);
  return Response.json({ ...resultado, imagens });
}
