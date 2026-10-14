import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_ESTADO_OAUTH, provedorVisivel, retornoDoOAuth } from "@/lib/recebimento-v2";
import { acessoV2 } from "../../acesso";

const TELA = "/painel/configuracoes/recebimento";

/** GET: "Conectar com {provedor}". Mercado Pago usa o fluxo que já existe. */
export async function GET(_: Request, ctx: { params: Promise<{ provedor: string }> }) {
  const { provedor } = await ctx.params;
  const { s, erro } = await acessoV2();
  if (erro) return erro;
  if (provedor === "mercadopago") redirect("/api/painel/recebimento/mercado-pago");
  const def = provedorVisivel(s.tenant, provedor);
  if (!def?.oauth) redirect(`${TELA}?conexao=indisponivel`);
  const estado = randomBytes(24).toString("base64url");
  (await cookies()).set(COOKIE_ESTADO_OAUTH, `${provedor}.${estado}`, { httpOnly: true, sameSite: "lax", secure: true, path: "/api/painel/recebimento/v2/conectar", maxAge: 600 });
  redirect(def.oauth.urlDeAutorizacao(estado, retornoDoOAuth(provedor)));
}
