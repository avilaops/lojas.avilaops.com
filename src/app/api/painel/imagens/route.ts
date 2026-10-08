import { exigir } from "@/lib/operadores";
import { prisma } from "@/lib/db";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { UPLOADS_DIR, UploadInvalido, salvarImagem, salvarBytes } from "@/lib/uploads";
import { FundoIndisponivel, removedorConfigurado, removerFundo } from "@/lib/fundo";
import { TETO_IMAGEM_BYTES, corpoAcimaDoTeto } from "@/lib/limites-upload";

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

  // Antes de `formData()`, que lê o corpo inteiro para a memória.
  if (corpoAcimaDoTeto(request, TETO_IMAGEM_BYTES)) return Response.json({ erro: "Imagem acima de 5 MB." }, { status: 413 });

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
    // O removedor aceita até 30 MB (tem outros chamadores); o painel, 5 MB.
    if (arquivo.size > TETO_IMAGEM_BYTES) return Response.json({ erro: "Imagem acima de 5 MB." }, { status: 422 });
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

/** DELETE ?url= removes only this store's uploaded image while unreferenced. */
export async function DELETE(request: Request) {
  const { s, erro } = await exigir("catalogo");
  if (erro) return erro;
  const urlTexto = new URL(request.url).searchParams.get("url") ?? "";
  let url: URL;
  try { url = new URL(urlTexto); } catch { return Response.json({ erro: "Imagem inválida." }, { status: 400 }); }
  const dominio = process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com";
  const partes = url.pathname.split("/");
  const nome = partes[3] ?? "";
  if (url.protocol !== "https:" || url.hostname !== dominio || partes.length !== 4 || partes[1] !== "uploads" || partes[2] !== s.tenant.slug || !/^[a-z0-9-]+\.(?:webp|jpe?g|png|gif|svg)$/i.test(nome) || url.search || url.hash) {
    return Response.json({ erro: "Só é possível remover um arquivo enviado por esta loja." }, { status: 403 });
  }
  const [produto, midia] = await Promise.all([
    prisma.produto.findFirst({ where: { imagens: { has: urlTexto } }, select: { id: true } }),
    prisma.midiaProduto.findFirst({ where: { url: urlTexto }, select: { id: true } }),
  ]);
  if (produto || midia) return Response.json({ erro: "A imagem já está vinculada a um produto e não pode ser removida por este fluxo." }, { status: 409 });
  try {
    await unlink(path.join(UPLOADS_DIR, s.tenant.slug, nome));
    return Response.json({ ok: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return Response.json({ erro: "O arquivo já não existe." }, { status: 404 });
    console.error("[imagens:excluir]", e);
    return Response.json({ erro: "Não foi possível remover o arquivo." }, { status: 500 });
  }
}
