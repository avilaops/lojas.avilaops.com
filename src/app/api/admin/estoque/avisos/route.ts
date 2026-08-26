import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { avisarQuemEsperava } from "@/lib/estoque-avisos";

/** POST — de hora em hora (n8n): avisa quem esperava produto que voltou ao estoque. */
export async function POST(request: Request) {
  if (!autorizado(request)) return naoAutorizado();
  return Response.json(await avisarQuemEsperava());
}
