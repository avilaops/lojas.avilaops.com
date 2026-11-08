import { z } from "zod";
import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { ImportacaoFotosSchema } from "@/lib/importacao-fotos";
import { importarImagemDeUrl } from "@/lib/uploads";
import { salvarProdutoNoCatalogo } from "@/lib/catalogo-escrita";
import { invalidarCatalogo } from "@/lib/catalogo-cache";
import { Prisma } from "@prisma/client";

/** Importa apenas mídia, sem reenviar preços, estoque ou outros campos comerciais. */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const loja = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!loja) return Response.json({ erro: "Loja não encontrada." }, { status: 404 });
  const entrada = z.array(ImportacaoFotosSchema).min(1).max(5).safeParse(await request.json().catch(() => null));
  if (!entrada.success) return Response.json({ erro: "Dados inválidos.", detalhes: entrada.error.flatten() }, { status: 422 });
  const resultados: { produtoId: string; estado: string; url?: string; motivo?: string }[] = [];
  for (const item of entrada.data) {
    const produto = await prisma.produto.findFirst({ where: { id: item.produtoId, tenantId: loja.id } });
    if (!produto || produto.sku !== item.sku || produto.nome !== item.nome || produto.versaoCatalogo !== item.versaoCatalogo || produto.imagens.length) {
      resultados.push({ produtoId: item.produtoId, estado: "ignorado", motivo: "Identidade, versão ou ausência de imagem mudou; pesquise novamente." }); continue;
    }
    try {
      const imagem = await importarImagemDeUrl(slug, item.imagemUrl);
      const atributos = produto.atributos && typeof produto.atributos === "object" && !Array.isArray(produto.atributos) ? produto.atributos : {};
      await salvarProdutoNoCatalogo(loja.id, produto.id, {
        imagens: [imagem.url], imagemOrigem: "representativa", imagemFamilia: item.familia,
        atributos: { ...atributos, _imagemCatalogo: { origem: item.imagemUrl, pagina: item.pagina, familia: item.familia, criterio: item.criterio } } as Prisma.InputJsonValue,
      }, { origem: "coleta-fotos-catalogo", versao: item.versaoCatalogo, exigirSemImagem: true, metadadosMidia: { fonte: item.pagina, correspondencia: "nao_confirmada" } });
      resultados.push({ produtoId: produto.id, estado: "importado", url: imagem.url });
    } catch (erro) { resultados.push({ produtoId: item.produtoId, estado: "falhou", motivo: erro instanceof Error ? erro.message : "Falha ao importar foto." }); }
  }
  if (resultados.some(r => r.estado === "importado")) invalidarCatalogo(loja.id);
  return Response.json({ resultados });
}
