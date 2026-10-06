import { z } from "zod";
import { prisma } from "@/lib/db";
import { emitir } from "@/lib/eventos";
import { gerarHashSenha } from "@/lib/sessao";
import { lerTokenDeRecuperacao, linkDeRecuperacao, tokenAindaValePara } from "@/lib/recuperacao";

/**
 * Recuperação de senha em dois passos, sem tabela nova:
 *
 *   POST { email }            → gera link com token de 1 h e emite o evento
 *                               `lojista.recuperar-senha`. Resposta é sempre
 *                               "se existir, enviamos" — não vaza cadastro.
 *   POST { token, senha }     → confere o token e troca a senha.
 *
 * O token está em src/lib/recuperacao.ts.
 */
const Pedido = z.object({ email: z.string().email() });
const Troca = z.object({ token: z.string().min(10), senha: z.string().min(8).max(200) });

export async function POST(request: Request) {
  const corpo = await request.json().catch(() => null);

  if (corpo && typeof corpo === "object" && "token" in corpo) {
    const troca = Troca.safeParse(corpo);
    if (!troca.success) return Response.json({ erro: "Link inválido ou senha curta (mínimo 8)." }, { status: 400 });
    const lido = lerTokenDeRecuperacao(troca.data.token);
    if ("erro" in lido) {
      return lido.erro === "expirado"
        ? Response.json({ erro: "Link expirado. Peça outro." }, { status: 410 })
        : Response.json({ erro: "Link inválido." }, { status: 400 });
    }
    const loja = await prisma.tenant.findUnique({ where: { slug: lido.slug } });
    if (!loja || !tokenAindaValePara(loja, lido.h)) return Response.json({ erro: "Link já usado ou inválido." }, { status: 410 });
    await prisma.tenant.update({ where: { id: loja.id }, data: { senhaHash: gerarHashSenha(troca.data.senha) } });
    return Response.json({ ok: true });
  }

  const pedido = Pedido.safeParse(corpo);
  if (!pedido.success) return Response.json({ erro: "Informe o e-mail." }, { status: 400 });
  const loja = await prisma.tenant.findUnique({ where: { loginEmail: pedido.data.email.toLowerCase() } });
  if (loja) {
    await emitir({ tipo: "lojista.recuperar-senha", slug: loja.slug, nome: loja.nome, email: loja.loginEmail!, link: linkDeRecuperacao(loja) });
  }
  return Response.json({ ok: true, mensagem: "Se este e-mail tiver uma loja, o link de redefinição chega em instantes." });
}
