import { chamadasDaLoja, RETENCAO_DIAS } from "@/lib/mcp-historico";
import { exigir } from "@/lib/operadores";

export const dynamic = "force-dynamic";

/**
 * GET — o que os assistentes fizeram na loja pelo conector.
 * `?alteracoes=1` deixa só o que mudou alguma coisa.
 */
export async function GET(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const soAlteracoes = new URL(request.url).searchParams.get("alteracoes") === "1";
  return Response.json({
    retencaoDias: RETENCAO_DIAS,
    chamadas: await chamadasDaLoja(s.tenant.id, { soAlteracoes }),
  });
}
