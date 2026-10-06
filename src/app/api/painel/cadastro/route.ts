import { z } from "zod";
import { prisma } from "@/lib/db";
import { emitir } from "@/lib/eventos";
import { normalizarEmailDoCadastro, planoDoCadastro, tokenDeCadastro } from "@/lib/cadastro";
import { linkDeRecuperacao } from "@/lib/recuperacao";

/**
 * Primeiro passo do cadastro: só o e-mail.
 *
 * A resposta é a mesma exista ou não conta com esse e-mail — senão esta rota
 * vira o jeito de descobrir quem é cliente. Quem já tem conta recebe, no lugar
 * da confirmação, o link para escolher uma senha nova: é o que essa pessoa
 * precisa, e chega na caixa dela, não na tela de quem digitou.
 */
const BASE = process.env.LOJAS_BASE_DOMAIN ?? "lojas.avilaops.com";
const Entrada = z.object({ email: z.string().trim().email(), plano: z.string().optional() });

// Freio contra usar o formulário para encher a caixa de alguém: por e-mail, em
// memória (uma instância, como o de /entrar).
const envios = new Map<string, { n: number; desde: number }>();
const JANELA_MS = 15 * 60_000;
const MAXIMO_NA_JANELA = 3;

function podeEnviar(email: string, agora = Date.now()): boolean {
  const atual = envios.get(email);
  if (!atual || agora - atual.desde > JANELA_MS) {
    if (envios.size > 5_000) for (const [k, v] of envios) if (agora - v.desde > JANELA_MS) envios.delete(k);
    envios.set(email, { n: 1, desde: agora });
    return true;
  }
  if (atual.n >= MAXIMO_NA_JANELA) return false;
  atual.n += 1;
  return true;
}

export async function POST(request: Request) {
  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Informe um e-mail válido." }, { status: 400 });
  const email = normalizarEmailDoCadastro(r.data.email);

  if (!podeEnviar(email)) {
    return Response.json({ erro: "Já enviamos alguns links para este e-mail. Confira a caixa de entrada e o spam, ou tente de novo em 15 minutos." }, { status: 429 });
  }

  const loja = await prisma.tenant.findUnique({ where: { loginEmail: email } });
  if (loja && loja.status !== "CANCELADA") {
    await emitir({ tipo: "lojista.recuperar-senha", slug: loja.slug, nome: loja.nome, email, link: linkDeRecuperacao(loja) });
  } else if (!loja) {
    const link = `https://${BASE}/confirmar?token=${encodeURIComponent(tokenDeCadastro(email, planoDoCadastro(r.data.plano)))}`;
    await emitir({ tipo: "lojista.confirmar-email", slug: "plataforma", email, link });
  }
  return Response.json({ ok: true, mensagem: "Enviamos um link para o seu e-mail. Abra-o para confirmar e criar a sua senha." });
}
