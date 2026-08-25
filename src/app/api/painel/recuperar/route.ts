import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { emitir } from "@/lib/eventos";
import { gerarHashSenha } from "@/lib/sessao";

/**
 * Recuperação de senha em dois passos, sem tabela nova:
 *
 *   POST { email }            → gera link com token de 1 h e emite o evento
 *                               `lojista.recuperar-senha` (o n8n manda o e-mail
 *                               pelo mail.avilaops.com). Resposta é sempre
 *                               "se existir, enviamos" — não vaza cadastro.
 *   POST { token, senha }     → confere o token e troca a senha.
 *
 * O token assina slug + validade + um pedaço do hash atual: usar uma vez
 * troca o hash e o mesmo token deixa de valer.
 */
const BASE = process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com";

function assinar(corpo: string) {
  return createHmac("sha256", Buffer.from(process.env.LOJAS_SECRET ?? "", "hex")).update(`recuperar:${corpo}`).digest("base64url");
}

function tokenPara(slug: string, senhaHash: string | null) {
  const corpo = Buffer.from(JSON.stringify({ slug, exp: Date.now() + 3_600_000, h: (senhaHash ?? "").slice(-12) })).toString("base64url");
  return `${corpo}.${assinar(corpo)}`;
}

const Pedido = z.object({ email: z.string().email() });
const Troca = z.object({ token: z.string().min(10), senha: z.string().min(8).max(200) });

export async function POST(request: Request) {
  const corpo = await request.json().catch(() => null);

  if (corpo && typeof corpo === "object" && "token" in corpo) {
    const troca = Troca.safeParse(corpo);
    if (!troca.success) return Response.json({ erro: "Link inválido ou senha curta (mínimo 8)." }, { status: 400 });
    const [dados, assinatura] = troca.data.token.split(".");
    if (!dados || !assinatura) return Response.json({ erro: "Link inválido." }, { status: 400 });
    const esperada = assinar(dados);
    if (esperada.length !== assinatura.length || !timingSafeEqual(Buffer.from(esperada), Buffer.from(assinatura))) return Response.json({ erro: "Link inválido." }, { status: 400 });
    const t = JSON.parse(Buffer.from(dados, "base64url").toString("utf8")) as { slug: string; exp: number; h: string };
    if (t.exp < Date.now()) return Response.json({ erro: "Link expirado. Peça outro." }, { status: 410 });
    const loja = await prisma.tenant.findUnique({ where: { slug: t.slug } });
    if (!loja || (loja.senhaHash ?? "").slice(-12) !== t.h) return Response.json({ erro: "Link já usado ou inválido." }, { status: 410 });
    await prisma.tenant.update({ where: { id: loja.id }, data: { senhaHash: gerarHashSenha(troca.data.senha) } });
    return Response.json({ ok: true });
  }

  const pedido = Pedido.safeParse(corpo);
  if (!pedido.success) return Response.json({ erro: "Informe o e-mail." }, { status: 400 });
  const loja = await prisma.tenant.findUnique({ where: { loginEmail: pedido.data.email.toLowerCase() } });
  if (loja) {
    const link = `https://${BASE}/redefinir?token=${encodeURIComponent(tokenPara(loja.slug, loja.senhaHash))}`;
    await emitir({ tipo: "lojista.recuperar-senha", slug: loja.slug, nome: loja.nome, email: loja.loginEmail!, link });
  }
  return Response.json({ ok: true, mensagem: "Se este e-mail tiver uma loja, o link de redefinição chega em instantes." });
}
