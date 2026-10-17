import { definirPadrao, PadraoRecusado } from "@/lib/credenciais";
import { acessoV2 } from "../acesso";

/** POST { credencialId }: a loja passa a cobrar com esta conta. */
export async function POST(request: Request) {
  const { s, erro } = await acessoV2();
  if (erro) return erro;
  const corpo = (await request.json().catch(() => null)) as { credencialId?: unknown } | null;
  try {
    await definirPadrao(s.tenant, String(corpo?.credencialId ?? ""));
  } catch (e) {
    if (e instanceof PadraoRecusado) return Response.json({ erro: e.message }, { status: 422 });
    throw e;
  }
  return Response.json({ ok: true });
}
