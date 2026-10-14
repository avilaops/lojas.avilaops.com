import { provedorVisivel, separarValores } from "@/lib/recebimento-v2";
import { acessoV2 } from "../acesso";

/** POST { provedor, valores }: testa o que está digitado, sem salvar. */
export async function POST(request: Request) {
  const { s, erro } = await acessoV2();
  if (erro) return erro;
  const corpo = (await request.json().catch(() => null)) as { provedor?: unknown; valores?: unknown } | null;
  const def = provedorVisivel(s.tenant, String(corpo?.provedor ?? ""));
  if (!def || def.tipoConexao === "oauth") return Response.json({ ok: false, mensagem: "Este provedor não se conecta por chave.", avisos: [] }, { status: 400 });
  const lido = separarValores(def, corpo?.valores);
  if (!lido.ok) return Response.json({ ok: false, mensagem: lido.mensagem, avisos: [] });
  return Response.json(await def.testarConexao(lido.ctx));
}
