import { prisma } from "@/lib/db";
import { conferirSaude } from "@/lib/saude";

/**
 * GET /api/health — probe do container (docker-compose) e do deploy.
 *
 * Sem cache: uma resposta guardada faria o deploy declarar saudável uma versão
 * que nunca respondeu. O contrato do corpo está em `src/lib/saude.ts`.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const { corpo, status } = await conferirSaude(() => prisma.$queryRaw`SELECT 1`);
  return Response.json(corpo, { status, headers: { "cache-control": "no-store" } });
}
