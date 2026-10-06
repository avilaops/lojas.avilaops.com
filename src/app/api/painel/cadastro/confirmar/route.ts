import { z } from "zod";
import { criarConta, lerTokenDeCadastro } from "@/lib/cadastro";
import { abrirSessao } from "@/lib/sessao";

/**
 * Segundo passo: o link do e-mail volta com o token e a senha escolhida. A
 * conta nasce aqui, já com a sessão aberta — a pessoa cai dentro do painel.
 *
 * O link pode ser aberto mais de uma vez enquanto vale; o que impede a segunda
 * conta é o e-mail já ter dono, não o token.
 */
const Entrada = z.object({ token: z.string().min(10), senha: z.string().min(8, "A senha precisa ter pelo menos 8 caracteres.").max(200) });

export async function POST(request: Request) {
  const r = Entrada.safeParse(await request.json().catch(() => null));
  if (!r.success) return Response.json({ erro: r.error.issues[0]?.path[0] === "senha" ? "A senha precisa ter pelo menos 8 caracteres." : "Link inválido." }, { status: 400 });

  const lido = lerTokenDeCadastro(r.data.token);
  if ("erro" in lido) {
    return lido.erro === "expirado"
      ? Response.json({ erro: "Este link venceu. Peça outro na página de cadastro." }, { status: 410 })
      : Response.json({ erro: "Link inválido. Peça outro na página de cadastro." }, { status: 400 });
  }

  const conta = await criarConta({ email: lido.email, senha: r.data.senha, plano: lido.plano });
  if (!conta) return Response.json({ erro: "Este e-mail já tem conta. Entre com a sua senha." }, { status: 409 });

  await abrirSessao(conta.slug);
  return Response.json({ ok: true }, { status: 201 });
}
