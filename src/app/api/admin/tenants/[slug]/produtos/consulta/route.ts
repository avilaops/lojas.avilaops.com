import { prisma } from "@/lib/db";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { consultarCatalogo, lerConsulta } from "@/lib/catalogo-admin-consulta";

type Ctx = { params: Promise<{ slug: string }> };

/**
 * GET — uma página do catálogo da loja, com busca, filtros, ordenação e os
 * totais (indicadores do catálogo inteiro, facetas e grupos).
 *
 * É o que o painel da Ávila Ops lê para navegar o catálogo. Só leitura. A loja
 * vem do endereço e toda consulta filtra por ela: não há parâmetro que faça
 * esta rota devolver produto de outra loja.
 */
export async function GET(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  const t = await prisma.tenant.findUnique({ where: { slug }, select: { id: true } });
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });

  const consulta = lerConsulta(new URL(request.url).searchParams);
  if (!consulta.success) return Response.json({ erro: "consulta inválida", detalhes: consulta.error.flatten() }, { status: 422 });

  // Resposta de administração: nada de cache no caminho.
  return Response.json(await consultarCatalogo(t.id, consulta.data), { headers: { "cache-control": "no-store" } });
}
