import { exigir } from "@/lib/operadores";
import { prisma } from "@/lib/db";
import { UploadInvalido, salvarImagem, salvarBytes } from "@/lib/uploads";
import { FundoIndisponivel, removedorConfigurado, removerFundo } from "@/lib/fundo";

/**
 * POST multipart (campo `arquivo`) → { url }. Usado para foto de produto,
 * logo, banner e imagem de categoria.
 *
 * `?tratar=1` passa a foto pelo removedor de fundo da casa antes de salvar:
 * recorte no produto, fundo branco, quadro quadrado e respiro igual em todas —
 * é o que faz um catálogo de celular parecer catálogo de loja grande.
 */
export async function POST(request: Request) {
  const { s, erro } = await exigir("catalogo");
  if (erro) return erro;
  const loja = s.tenant;

  const form = await request.formData().catch(() => null);
  const arquivo = form?.get("arquivo");
  if (!(arquivo instanceof File)) return Response.json({ erro: "Envie um arquivo no campo 'arquivo'." }, { status: 400 });
  const sku = String(form?.get("sku") ?? "").trim();
  const produto = sku ? await prisma.produto.findFirst({ where: { tenantId: loja.id, sku }, select: { id: true, nome: true, imagens: true } }) : null;
  if (sku && !produto) return Response.json({ erro: `SKU ${sku} não encontrado nesta loja.` }, { status: 404 });
  if (produto?.imagens.length) return Response.json({ erro: `${sku}: o produto já tem foto principal. Remova ou revise a foto no cadastro antes de enviar outra.` }, { status: 409 });

  const tratar = new URL(request.url).searchParams.get("tratar") === "1";
  try {
    if (!tratar) {
      const r = await salvarImagem(loja.slug, arquivo);
      return Response.json({ url: r.url, tratada: false, ...(produto ? { sku, produto: produto.nome, produtoId: produto.id } : {}) });
    }
    if (!removedorConfigurado()) return Response.json({ erro: "Tratamento de imagem indisponível nesta instalação." }, { status: 503 });
    const bytes = Buffer.from(await arquivo.arrayBuffer());
    const recortada = await removerFundo(bytes);
    const r = await salvarBytes(loja.slug, recortada, "webp");
    return Response.json({ url: r.url, tratada: true });
  } catch (erro) {
    if (erro instanceof UploadInvalido) return Response.json({ erro: erro.message }, { status: 422 });
    if (erro instanceof FundoIndisponivel) return Response.json({ erro: `${erro.message} Envie a foto sem tratamento.` }, { status: 503 });
    console.error("[imagens]", erro);
    return Response.json({ erro: "Não foi possível salvar a imagem." }, { status: 500 });
  }
}

/** GET — o painel pergunta se pode oferecer o botão "tratar com IA". */
export function GET() {
  return Response.json({ tratamentoDisponivel: removedorConfigurado() });
}
