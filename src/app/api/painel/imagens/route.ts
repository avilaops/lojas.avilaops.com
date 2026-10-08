import { exigir } from "@/lib/operadores";
import { prisma } from "@/lib/db";
import { unlink } from "node:fs/promises";
import path from "node:path";
import { UPLOADS_DIR, salvarImagem, salvarBytes } from "@/lib/uploads";
import { FundoIndisponivel, removedorConfigurado, removerFundo } from "@/lib/fundo";
import { receberImagem } from "@/lib/envios-do-painel";

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
  // As barreiras de tamanho e a ordem delas estão em `receberImagem`, com teste.
  return receberImagem(request, s.tenant, {
    produtoPorSku: (tenantId, sku) => prisma.produto.findFirst({ where: { tenantId, sku }, select: { id: true, nome: true, imagens: true } }),
    salvarImagem,
    salvarBytes,
    removedorConfigurado,
    removerFundo,
    eFundoIndisponivel: (e): e is FundoIndisponivel => e instanceof FundoIndisponivel,
  });
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
