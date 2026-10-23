import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { COOKIE_SESSAO } from "@/lib/atribuicao";
import { eventoFunilDaVitrine } from "@/lib/analytics-contrato";
import { camposDaSessaoParaEvento } from "@/lib/funil-analytics";
import { tenantAtual } from "@/lib/tenant";

/** Registra somente marcos agregados da sessão; nenhum payload livre é aceito. */
export async function POST(request: Request) {
  const entrada = eventoFunilDaVitrine.safeParse(await request.json().catch(() => null));
  if (!entrada.success) return new Response(null, { status: 400 });

  const [tenant, jar] = await Promise.all([tenantAtual(), cookies()]);
  const chave = jar.get(COOKIE_SESSAO)?.value;
  if (!tenant || tenant.status !== "ATIVA" || !chave) return new Response(null, { status: 202 });

  await prisma.sessaoVitrine.updateMany({
    where: { tenantId: tenant.id, chave },
    data: camposDaSessaoParaEvento(entrada.data.event),
  });
  return new Response(null, { status: 204 });
}

