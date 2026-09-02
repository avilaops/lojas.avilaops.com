import { z } from "zod";
import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { ProdutoImportadoSchema } from "@/lib/admin-schemas";
import { importarProdutos } from "@/lib/admin-tenants";
import { importarImagemDeUrl } from "@/lib/uploads";

const BASE = (process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com").toLowerCase();

type Ctx = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const t = await prisma.tenant.findUnique({ where: { slug } });
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
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
  return Response.json({ ...resultado, imagens });
}
