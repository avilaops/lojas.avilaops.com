import { lojistaAtual } from "@/lib/sessao";
import { UploadInvalido, salvarImagem } from "@/lib/uploads";

/** POST multipart (campo `arquivo`) → { url }. Usado para foto de produto e logo. */
export async function POST(request: Request) {
  const loja = await lojistaAtual();
  if (!loja) return Response.json({ erro: "Sessão expirada." }, { status: 401 });
  const form = await request.formData().catch(() => null);
  const arquivo = form?.get("arquivo");
  if (!(arquivo instanceof File)) return Response.json({ erro: "Envie um arquivo no campo 'arquivo'." }, { status: 400 });
  try {
    const r = await salvarImagem(loja.slug, arquivo);
    return Response.json({ url: r.url });
  } catch (erro) {
    if (erro instanceof UploadInvalido) return Response.json({ erro: erro.message }, { status: 422 });
    console.error("[imagens]", erro);
    return Response.json({ erro: "Não foi possível salvar a imagem." }, { status: 500 });
  }
}
