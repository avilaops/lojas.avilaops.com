import { z } from "zod";
import { exigir } from "@/lib/operadores";
import { avisarBuscadores } from "@/lib/indexnow";
import { emitir } from "@/lib/eventos";
import { gerarRascunhoSeoCategoria, publicarSeoCategoria } from "@/lib/seo-categorias";
import { urlDaLoja } from "@/lib/tenant";

const Gerar = z.object({ id: z.string().min(1), contexto: z.string().trim().max(500).optional() });
const Publicar = z.object({
  id: z.string().min(1),
  titulo: z.string().trim().min(3).max(70),
  descricao: z.string().trim().min(40).max(170),
  palavrasChave: z.array(z.string().trim().min(2).max(50)).max(10),
  origem: z.enum(["manual", "gemini", "fallback"]).default("manual"),
  modelo: z.string().trim().max(100).nullable().optional(),
});

/** POST: gera rascunho, mas não publica sem a revisão do lojista. */
export async function POST(request: Request) {
  const { s, erro } = await exigir("catalogo");
  if (erro) return erro;
  const loja = s.tenant;
  const entrada = Gerar.safeParse(await request.json().catch(() => null));
  if (!entrada.success) return Response.json({ erro: "Categoria ou contexto inválido." }, { status: 422 });
  const resultado = await gerarRascunhoSeoCategoria(loja, entrada.data.id, entrada.data.contexto);
  if (!resultado) return Response.json({ erro: "Categoria não encontrada." }, { status: 404 });
  return Response.json(resultado.rascunho);
}

/** PUT: publica o rascunho revisado no banco e avisa os buscadores. */
export async function PUT(request: Request) {
  const { s, erro } = await exigir("catalogo");
  if (erro) return erro;
  const loja = s.tenant;
  const entrada = Publicar.safeParse(await request.json().catch(() => null));
  if (!entrada.success) return Response.json({ erro: "Revise o título, a descrição e as palavras-chave." }, { status: 422 });
  const { id, titulo, descricao, palavrasChave, origem, modelo } = entrada.data;
  const categoria = await publicarSeoCategoria(loja.id, id, {
    dados: { titulo, descricao, palavrasChave },
    origem,
    modelo: modelo ?? null,
  });
  if (!categoria) return Response.json({ erro: "Categoria não encontrada." }, { status: 404 });
  void avisarBuscadores(loja, [`/categoria/${categoria.slug}`, "/sitemap.xml"]);
  void emitir({
    tipo: "categoria.seo-publicado",
    slug: loja.slug,
    nome: loja.nome,
    categoriaId: categoria.id,
    categoriaSlug: categoria.slug,
    categoriaNome: categoria.nome,
    url: `${urlDaLoja(loja)}/categoria/${categoria.slug}`,
    origem: categoria.seoOrigem ?? "manual",
  });
  return Response.json(categoria);
}
