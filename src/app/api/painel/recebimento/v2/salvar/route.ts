import { prisma } from "@/lib/db";
import { credencialParaTela, definirPadrao, salvarCredencial } from "@/lib/credenciais";
import { provedorVisivel, separarValores } from "@/lib/recebimento-v2";
import { acessoV2 } from "../acesso";

/**
 * POST { provedor, valores }: testa e salva. Salva mesmo com o teste falhando
 * (fica "Erro", com a mensagem), para o lojista não redigitar tudo; só
 * Conectado pode virar padrão. A primeira conta conectada vira a padrão.
 */
export async function POST(request: Request) {
  const { s, erro } = await acessoV2();
  if (erro) return erro;
  const corpo = (await request.json().catch(() => null)) as { provedor?: unknown; valores?: unknown } | null;
  const def = provedorVisivel(s.tenant, String(corpo?.provedor ?? ""));
  if (!def || def.tipoConexao === "oauth") return Response.json({ erro: "Este provedor não se conecta por chave." }, { status: 400 });
  const lido = separarValores(def, corpo?.valores);
  if (!lido.ok) return Response.json({ erro: lido.mensagem }, { status: 422 });

  const teste = await def.testarConexao(lido.ctx);
  const c = await salvarCredencial(s.tenant, def.id, { segredos: lido.segredos, publicos: lido.publicos }, teste);
  const loja = await prisma.tenant.findUniqueOrThrow({ where: { id: s.tenant.id } });
  if (teste.ok && !loja.credencialPadraoId) await definirPadrao(loja, c.id);
  const padraoId = (await prisma.tenant.findUniqueOrThrow({ where: { id: s.tenant.id } })).credencialPadraoId;
  return Response.json({ teste, credencial: credencialParaTela(c, padraoId) });
}
