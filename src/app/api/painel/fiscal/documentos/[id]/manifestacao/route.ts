import { ErroFiscal } from "@/lib/fiscal-certificado";
import { cabecalhosDoLimite, LimitadorPorJanela } from "@/lib/api-limite";
import { manifestarDocumento, TIPOS_MANIFESTACAO, type TipoManifestacao } from "@/lib/fiscal-manifestacao";
import { origemFiscalPermitida } from "@/lib/fiscal-origem";
import { exigir } from "@/lib/operadores";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const limitador = new LimitadorPorJanela();

export async function POST(request: Request, contexto: { params: Promise<{ id: string }> }) {
  const { s, erro } = await exigir("fiscal");
  if (erro) return erro;
  const limite = limitador.consumir(`${s.tenant.id}:manifestacao`, 5);
  if (!limite.permitido) return Response.json({ erro: "Aguarde antes de enviar outra manifestação fiscal." }, { status: 429, headers: { ...cabecalhosDoLimite(limite), "Retry-After": String(limite.reiniciaEm) } });
  if (!origemFiscalPermitida(request)) return Response.json({ erro: "Origem da ação fiscal recusada." }, { status: 403 });
  try {
    const corpo = await request.json() as { tipo?: string; justificativa?: string; confirmacao?: boolean };
    if (corpo.confirmacao !== true || !corpo.tipo || !(corpo.tipo in TIPOS_MANIFESTACAO)) {
      throw new ErroFiscal("Confirme explicitamente a manifestação fiscal escolhida.");
    }
    const { id } = await contexto.params;
    const resultado = await manifestarDocumento({
      tenantId: s.tenant.id,
      documentoId: id,
      tipo: corpo.tipo as TipoManifestacao,
      justificativa: corpo.justificativa,
      autor: s.operador?.email ?? s.tenant.loginEmail ?? "dono-da-loja",
    });
    return Response.json({
      status: resultado.status,
      codigo: resultado.codigoRetorno,
      motivo: resultado.motivoRetorno,
      protocolo: resultado.protocolo,
      aceita: resultado.status === "ACEITA",
    }, { headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (falha) {
    const mensagem = falha instanceof ErroFiscal ? falha.message : "Não foi possível concluir a manifestação fiscal.";
    return Response.json({ erro: mensagem }, { status: 422, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  }
}
