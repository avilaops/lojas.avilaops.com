import { prisma } from "@/lib/db";
import { MANIFESTO, SEM_CACHE, autorizado, naoEncontrado, noDominioDaPlataforma } from "@/lib/gapp";

/**
 * GET /v1/ops/status — backup, migrações e segredos (CT-21).
 *
 * A app responde o que ela consegue provar de dentro: qual migração está
 * aplicada e quando. Backup roda fora dela, no servidor, então aqui vai a
 * agenda declarada, e não uma confirmação que a app não tem como dar.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!(await noDominioDaPlataforma())) return naoEncontrado();
  const auth = autorizado(request);
  if (!auth.ok) return auth.resposta;

  const linhas = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: Date | null }>>`
    select migration_name, finished_at
      from _prisma_migrations
     order by finished_at desc nulls first
     limit 1
  `;
  const ultima = linhas[0];

  const pendentes = await prisma.$queryRaw<Array<{ n: bigint }>>`
    select count(*) as n from _prisma_migrations where finished_at is null
  `;

  return Response.json(
    {
      migracoes: {
        ferramenta: MANIFESTO.db.migrations.tool,
        ultima: ultima?.migration_name ?? null,
        aplicada_em: ultima?.finished_at?.toISOString() ?? null,
        pendentes: Number(pendentes[0]?.n ?? 0),
      },
      backup: {
        agenda: MANIFESTO.db.backup.schedule,
        retencao: MANIFESTO.db.backup.retention,
        executor: "servidor applications, fora da app",
      },
      segredos: {
        backend: MANIFESTO.secrets.backend,
        itens: MANIFESTO.secrets.inventory.length,
        harness_configurado: Boolean(process.env.GAPP_HARNESS_TOKEN),
      },
    },
    { headers: SEM_CACHE },
  );
}
