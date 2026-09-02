import { z } from "zod";
import { prisma } from "@/lib/db";
import { abrirSessao } from "@/lib/sessao";
import { autenticar, normalizarEmail } from "@/lib/operadores";

const Entrada = z.object({ email: z.string().email(), senha: z.string().min(1) });

// Freio simples contra força bruta: por e-mail, em memória (uma instância).
const tentativas = new Map<string, { n: number; ate: number }>();

/**
 * Entrada no painel, para o dono e para a equipe que ele cadastrou.
 *
 * O e-mail é procurado em dois lugares: `Tenant.loginEmail` (o dono) e
 * `OperadorLoja` (quem o lojista criou). Antes só existia o primeiro, e por
 * isso operador nenhum conseguiria entrar por aqui.
 */
export async function POST(request: Request) {
  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: "Informe e-mail e senha." }, { status: 400 });
  const email = normalizarEmail(r.data.email);

  const t = tentativas.get(email);
  if (t && t.n >= 8 && t.ate > Date.now()) return Response.json({ erro: "Muitas tentativas. Aguarde 15 minutos." }, { status: 429 });

  const recusar = () => {
    tentativas.set(email, { n: (t?.n ?? 0) + 1, ate: Date.now() + 15 * 60_000 });
    // Mesma resposta para e-mail inexistente, senha errada, acesso desligado e
    // loja cancelada: qualquer diferença conta a quem tentou se o e-mail existe.
    return Response.json({ erro: "E-mail ou senha incorretos." }, { status: 401 });
  };

  // O e-mail identifica a loja de duas formas, e o dono vem primeiro: ele é
  // quem não pode ficar de fora por um cadastro de equipe mal feito.
  const loja =
    (await prisma.tenant.findUnique({ where: { loginEmail: email } })) ??
    (await prisma.operadorLoja
      .findFirst({ where: { email, ativo: true }, select: { tenant: true } })
      .then((o) => o?.tenant ?? null));

  if (!loja || loja.status === "CANCELADA") return recusar();

  const quem = await autenticar(loja, email, r.data.senha);
  if (!quem) return recusar();

  tentativas.delete(email);
  await abrirSessao(quem.tenant.slug, quem.operador?.id);
  return Response.json({ slug: quem.tenant.slug, papel: quem.papel, nome: quem.operador?.nome ?? null });
}
