import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { lerNegocio24h } from "@/lib/metricas-negocio";
import { montarRelatorioDeMetricas } from "@/lib/metricas-relatorio";
import { RETENCAO_MINUTOS, registroGlobal } from "@/lib/metricas-tenant";

export const dynamic = "force-dynamic";

/**
 * GET ?minutos=1..60 — métricas por loja para o operador (n8n ou gente).
 *
 * Operação (latência e erros) sai da memória do processo e zera no deploy:
 * `processoDesde` diz desde quando vale. Negócio (sessões, pedidos e
 * conversão) é das últimas 24 h, do banco. Ver docs/METRICAS.md.
 */
export async function GET(request: Request) {
  if (!autorizado(request)) return naoAutorizado();

  const bruto = new URL(request.url).searchParams.get("minutos");
  const minutos = bruto === null ? RETENCAO_MINUTOS : /^\d{1,2}$/.test(bruto) ? Number(bruto) : NaN;
  if (!Number.isInteger(minutos) || minutos < 1 || minutos > RETENCAO_MINUTOS) {
    return Response.json({ erro: `minutos deve ser um inteiro de 1 a ${RETENCAO_MINUTOS}` }, { status: 400, headers: { "cache-control": "no-store" } });
  }

  const agora = new Date();
  const { lojas, negocio } = await lerNegocio24h(agora);
  const relatorio = montarRelatorioDeMetricas(registroGlobal().resumo({ minutos }), lojas, negocio, agora);
  return Response.json(relatorio, { headers: { "cache-control": "no-store" } });
}
