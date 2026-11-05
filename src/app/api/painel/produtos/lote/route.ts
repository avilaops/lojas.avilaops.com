import { z } from "zod";
import { prisma } from "@/lib/db";
import { exigir } from "@/lib/operadores";
import { alterarAtivoEmLote, respostaErroCatalogo } from "@/lib/catalogo-escrita";
import { origemDoPainel } from "@/lib/catalogo-origem";
import { invalidarCatalogo } from "@/lib/catalogo-cache";
import { condicaoDoCatalogo } from "@/lib/catalogo-filtros";

const Entrada = z.object({
  q: z.string().trim().max(120).optional(),
  marca: z.string().trim().max(120).optional(),
  categoria: z.string().trim().max(120).optional(),
  situacao: z.string().trim().max(40).optional(),
  ativo: z.boolean(),
}).strict().refine((v) => Boolean(v.marca || v.categoria), "Informe marca ou categoria.");

/** Altera o estado de todos os produtos da marca ou categoria selecionada. */
export async function POST(request: Request) {
  const { s, erro } = await exigir("catalogo");
  if (erro) return erro;
  const entrada = Entrada.safeParse(await request.json().catch(() => null));
  if (!entrada.success) return Response.json({ erro: "Informe uma marca ou categoria válida e o estado desejado." }, { status: 422 });

  const loja = s.tenant;
  const { q, marca, categoria, situacao, ativo } = entrada.data;
  const filtro = await condicaoDoCatalogo(loja.id, { busca: q, marca, categoria, situacao });
  const produtos = await prisma.produto.findMany({
    where: { AND: [filtro, ativo ? { ativo: false } : { ativo: true }] },
    select: { id: true },
  });

  try {
    const alterados = await alterarAtivoEmLote(loja.id, produtos.map((produto) => produto.id), ativo, origemDoPainel(s));
    if (alterados) invalidarCatalogo(loja.id);
    return Response.json({ ok: true, encontrados: produtos.length, alterados, ativo });
  } catch (e) {
    return respostaErroCatalogo(e);
  }
}
