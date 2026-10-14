import { dadosDaTela } from "@/lib/recebimento-v2";
import { acessoV2 } from "./acesso";

/** GET: provedores visíveis para a loja e as credenciais dela, sem segredo. */
export async function GET() {
  const { s, erro } = await acessoV2();
  if (erro) return erro;
  return Response.json(await dadosDaTela(s.tenant));
}
