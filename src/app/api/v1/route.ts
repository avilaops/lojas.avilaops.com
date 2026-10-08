import { indiceDaApi } from "@/lib/api-indice";

/**
 * GET /api/v1 — o índice da API, sem chave.
 *
 * Quem recebe a chave e não tem a documentação à mão descobre aqui as rotas,
 * o escopo de cada uma e como autenticar. O dado é o mesmo da página pública
 * `/developers` (`src/lib/api-indice.ts`).
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(indiceDaApi());
}
