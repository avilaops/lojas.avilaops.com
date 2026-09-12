import { z } from "zod";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { rodarMercadoLivre } from "@/lib/mercadolivre-publicacao";

const Entrada = z.object({
  slug: z.string().regex(/^[a-z0-9-]+$/).optional(),
  limite: z.number().int().min(1).max(100).optional(),
  preparar: z.number().int().min(0).max(50).optional(),
});

export async function POST(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  const entrada = Entrada.safeParse(await request.json().catch(() => ({})));
  if (!entrada.success) return Response.json({ erro: "dados inválidos", detalhes: entrada.error.flatten() }, { status: 422 });
  const resumo = await rodarMercadoLivre(entrada.data);
  return Response.json(resumo, { status: resumo.falhas ? 207 : 200 });
}
