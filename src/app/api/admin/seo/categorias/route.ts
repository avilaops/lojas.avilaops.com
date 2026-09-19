import { z } from "zod";
import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { filaSeoCategorias, processarSeoCategoriasPendentes } from "@/lib/seo-categorias";

const Entrada = z.object({ limite: z.number().int().min(1).max(25).default(10), tenantSlug: z.string().trim().max(80).optional() });

/** Visibilidade da fila, sem gastar IA. */
export async function GET(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  return Response.json(await filaSeoCategorias());
}

/**
 * POST — disparo manual do lote. O agendamento diário é do agendador interno
 * (`seo.categorias` em src/lib/rotinas.ts), que chama a mesma função.
 */
export async function POST(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  const entrada = Entrada.safeParse(await request.json().catch(() => ({})));
  if (!entrada.success) return Response.json({ erro: "Parâmetros inválidos." }, { status: 422 });
  return Response.json(await processarSeoCategoriasPendentes(entrada.data));
}
