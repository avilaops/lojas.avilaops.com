import { headers } from "next/headers";
import { ZodError } from "zod";
import { cabecalhosDoLimite, LimitadorPorJanela } from "@/lib/api-limite";
import { recursoAtivo } from "@/lib/recursos";
import { RetomadaNaoEncontradaError, retomarConfiguracaoSobMedida } from "@/lib/solicitacoes-sob-medida";
import { tenantAtual } from "@/lib/tenant";

const limitador = new LimitadorPorJanela();

export async function POST(request: Request) {
  const tenant = await tenantAtual();
  if (!tenant || !recursoAtivo(tenant, "configurador_sob_medida")) {
    return Response.json({ erro: "Configurador não encontrado." }, { status: 404 });
  }

  const cabecalhos = await headers();
  const ip = cabecalhos.get("cf-connecting-ip") ?? cabecalhos.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "desconhecido";
  const limite = limitador.consumir(`${tenant.id}:${ip}`, 10);
  if (!limite.permitido) {
    return Response.json({ erro: "Aguarde antes de tentar outro código." }, {
      status: 429,
      headers: { ...cabecalhosDoLimite(limite), "Retry-After": String(limite.reiniciaEm) },
    });
  }

  try {
    const entrada = await request.json();
    return Response.json(await retomarConfiguracaoSobMedida(tenant.id, entrada), {
      headers: { ...cabecalhosDoLimite(limite), "Cache-Control": "no-store" },
    });
  } catch (erro) {
    if (erro instanceof RetomadaNaoEncontradaError) {
      return Response.json({ erro: erro.message }, { status: 404, headers: cabecalhosDoLimite(limite) });
    }
    if (erro instanceof ZodError) {
      return Response.json({ erro: "Informe um código de retomada válido." }, { status: 422, headers: cabecalhosDoLimite(limite) });
    }
    if (erro instanceof SyntaxError) {
      return Response.json({ erro: "JSON inválido." }, { status: 400, headers: cabecalhosDoLimite(limite) });
    }
    console.error("Falha ao retomar configuração sob medida", { tenantId: tenant.id, erro });
    return Response.json({ erro: "Não foi possível retomar agora." }, { status: 500, headers: cabecalhosDoLimite(limite) });
  }
}
