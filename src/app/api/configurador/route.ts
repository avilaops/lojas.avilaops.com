import { headers } from "next/headers";
import { ZodError } from "zod";
import { cabecalhosDoLimite, LimitadorPorJanela } from "@/lib/api-limite";
import { recursoAtivo } from "@/lib/recursos";
import { criarSolicitacaoSobMedida, LogoSobMedidaInvalidaError } from "@/lib/solicitacoes-sob-medida";
import { LIMITE_LOGO_SOB_MEDIDA } from "@/lib/configurador-sob-medida";
import { tenantAtual } from "@/lib/tenant";

const limitador = new LimitadorPorJanela();
const limiteCorpo = LIMITE_LOGO_SOB_MEDIDA + 16_384;

export async function POST(request: Request) {
  const tenant = await tenantAtual();
  if (!tenant || !recursoAtivo(tenant, "configurador_sob_medida")) return Response.json({ erro: "Configurador não encontrado." }, { status: 404 });

  const cabecalhos = await headers();
  const ip = cabecalhos.get("cf-connecting-ip") ?? cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconhecido";
  const limite = limitador.consumir(`${tenant.id}:${ip}`, 5);
  if (!limite.permitido) {
    return Response.json({ erro: "Aguarde antes de enviar outra solicitação." }, {
      status: 429,
      headers: { ...cabecalhosDoLimite(limite), "Retry-After": String(limite.reiniciaEm) },
    });
  }

  try {
    const leitor = request.body?.getReader();
    const partes: Uint8Array[] = [];
    let tamanho = 0;
    while (leitor) {
      const { done, value } = await leitor.read();
      if (done) break;
      tamanho += value.byteLength;
      if (tamanho > limiteCorpo) {
        await leitor.cancel().catch(() => {});
        return Response.json({ erro: "Solicitação muito grande." }, { status: 413, headers: cabecalhosDoLimite(limite) });
      }
      partes.push(value);
    }
    const entrada = JSON.parse(Buffer.concat(partes).toString("utf8"));
    return Response.json(await criarSolicitacaoSobMedida(tenant.id, entrada), {
      status: 201,
      headers: { ...cabecalhosDoLimite(limite), "Cache-Control": "no-store" },
    });
  } catch (erro) {
    if (erro instanceof LogoSobMedidaInvalidaError) return Response.json({ erro: erro.message }, { status: 422, headers: cabecalhosDoLimite(limite) });
    if (erro instanceof ZodError) return Response.json({ erro: "Revise os dados informados.", detalhes: erro.flatten() }, { status: 422, headers: cabecalhosDoLimite(limite) });
    if (erro instanceof SyntaxError) return Response.json({ erro: "JSON inválido." }, { status: 400, headers: cabecalhosDoLimite(limite) });
    console.error("Falha ao salvar solicitação sob medida", { tenantId: tenant.id, erro });
    return Response.json({ erro: "Não foi possível salvar agora." }, { status: 500, headers: cabecalhosDoLimite(limite) });
  }
}
