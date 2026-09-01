import { prisma } from "@/lib/db";
import { MANIFESTO, SEM_CACHE, naoEncontrado, noDominioDaPlataforma } from "@/lib/gapp";

/**
 * GET /v1/ready — pronta para receber tráfego (CT-18).
 *
 * Aqui o banco é consultado, porque sem banco a loja não mostra produto nem
 * fecha pedido: responder 200 nesse estado seria mentir para quem decide
 * mandar tráfego.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await noDominioDaPlataforma())) return naoEncontrado();

  const inicio = Date.now();
  try {
    await prisma.$queryRaw`select 1`;
  } catch {
    return Response.json({ status: "indisponivel", db: "erro" }, { status: 503, headers: SEM_CACHE });
  }

  return Response.json(
    { status: "ok", app: MANIFESTO.app.id, db: "ok", db_ms: Date.now() - inicio },
    { headers: SEM_CACHE },
  );
}
