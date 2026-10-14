import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { definirPadrao, salvarCredencial } from "@/lib/credenciais";
import { COOKIE_ESTADO_OAUTH, provedorVisivel, retornoDoOAuth } from "@/lib/recebimento-v2";
import { acessoV2 } from "../../../acesso";

const TELA = "/painel/configuracoes/recebimento";

/** Volta do OAuth do provedor: confere o estado, troca o código, testa e salva. */
export async function GET(request: Request, ctx: { params: Promise<{ provedor: string }> }) {
  const { provedor } = await ctx.params;
  const { s, erro } = await acessoV2();
  if (erro) return erro;
  const def = provedorVisivel(s.tenant, provedor);
  if (!def?.oauth) redirect(`${TELA}?conexao=indisponivel`);

  const url = new URL(request.url);
  const store = await cookies();
  const guardado = store.get(COOKIE_ESTADO_OAUTH)?.value ?? "";
  store.delete({ name: COOKIE_ESTADO_OAUTH, path: "/api/painel/recebimento/v2/conectar" });
  const esperado = `${provedor}.${url.searchParams.get("state") ?? ""}`;
  const confere = guardado.length === esperado.length && guardado.length > provedor.length + 1 && timingSafeEqual(Buffer.from(guardado), Buffer.from(esperado));
  const codigo = url.searchParams.get("code");
  if (!confere || !codigo) redirect(`${TELA}?conexao=falhou`);

  let dados;
  try {
    dados = await def.oauth.concluir(codigo, retornoDoOAuth(provedor));
  } catch {
    redirect(`${TELA}?conexao=falhou`);
  }
  const teste = await def.testarConexao({ segredos: dados.segredos, publicos: dados.publicos });
  const c = await salvarCredencial(s.tenant, def.id, dados, teste);
  const loja = await prisma.tenant.findUniqueOrThrow({ where: { id: s.tenant.id } });
  if (teste.ok && !loja.credencialPadraoId) await definirPadrao(loja, c.id);
  redirect(`${TELA}?conexao=${teste.ok ? "ok" : "erro"}`);
}
