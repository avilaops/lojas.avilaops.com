import { z } from "zod";
import { prisma } from "@/lib/db";
import { abrirSessao, conferirSenha } from "@/lib/sessao";

const Entrada = z.object({ email: z.string().email(), senha: z.string().min(1) });

// Freio simples contra força bruta: por e-mail, em memória (uma instância).
const tentativas = new Map<string, { n: number; ate: number }>();

export async function POST(request: Request) {
  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Informe e-mail e senha." }, { status: 400 });
  const email = r.data.email.toLowerCase();

  const t = tentativas.get(email);
  if (t && t.n >= 8 && t.ate > Date.now()) return Response.json({ erro: "Muitas tentativas. Aguarde 15 minutos." }, { status: 429 });

  const loja = await prisma.tenant.findUnique({ where: { loginEmail: email } });
  if (!loja || !conferirSenha(r.data.senha, loja.senhaHash) || loja.status === "CANCELADA") {
    tentativas.set(email, { n: (t?.n ?? 0) + 1, ate: Date.now() + 15 * 60_000 });
    return Response.json({ erro: "E-mail ou senha incorretos." }, { status: 401 });
  }

  tentativas.delete(email);
  await abrirSessao(loja.slug);
  return Response.json({ slug: loja.slug });
}
