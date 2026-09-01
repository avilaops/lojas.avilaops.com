import { MANIFESTO, SEM_CACHE, naoEncontrado, noDominioDaPlataforma } from "@/lib/gapp";

/**
 * GET /v1/health — sinal de vida (CT-17). Pública, é o que tira a app do L0.
 *
 * Não toca no banco de propósito: health responde "o processo está de pé".
 * Banco fora do ar com processo vivo é assunto de /v1/ready, e misturar os
 * dois faz o coletor declarar a app morta numa manutenção de Postgres.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await noDominioDaPlataforma())) return naoEncontrado();
  return Response.json(
    {
      status: "ok",
      app: MANIFESTO.app.id,
      version: MANIFESTO.app.version,
      env: MANIFESTO.app.env,
      uptime_s: Math.round(process.uptime()),
      hora: new Date().toISOString(),
    },
    { headers: SEM_CACHE },
  );
}
