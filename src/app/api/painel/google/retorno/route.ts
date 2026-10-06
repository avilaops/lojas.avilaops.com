import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { criarConta } from "@/lib/cadastro";
import { COOKIE_ESTADO, estadoConfere, googleConfigurado, trocarCodigoPorEmail } from "@/lib/google-entrada";
import { abrirSessao } from "@/lib/sessao";

/**
 * Volta do Google. O mesmo botão serve para entrar e para criar conta:
 *
 *   e-mail do dono de uma loja   → entra nela
 *   e-mail de alguém da equipe   → entra como essa pessoa
 *   e-mail sem conta             → a conta nasce aqui, sem senha, e a pessoa
 *                                  cai nos primeiros passos do painel
 */
// `new Response` e não `Response.redirect`, que tem cabeçalhos imutáveis: o
// cookie da sessão precisa sair nesta resposta. Endereço relativo: vale no
// domínio-base e no desenvolvimento, sem montar host.
function irPara(caminho: string) {
  return new Response(null, { status: 302, headers: { location: caminho } });
}

export async function GET(request: Request) {
  if (!googleConfigurado()) return new Response("Não encontrado.", { status: 404 });
  const url = new URL(request.url);
  const store = await cookies();
  const guardado = store.get(COOKIE_ESTADO)?.value;
  store.delete({ name: COOKIE_ESTADO, path: "/api/painel/google" });

  const codigo = url.searchParams.get("code");
  if (!codigo || !estadoConfere(url.searchParams.get("state"), guardado)) return irPara("/entrar?google=falhou");

  const email = await trocarCodigoPorEmail(codigo).catch((e) => {
    console.error("[google] retorno:", e instanceof Error ? e.message : e);
    return null;
  });
  if (!email) return irPara("/entrar?google=falhou");

  const dono = await prisma.tenant.findUnique({ where: { loginEmail: email } });
  if (dono) {
    if (dono.status === "CANCELADA") return irPara("/entrar?google=falhou");
    await abrirSessao(dono.slug);
    return irPara("/painel");
  }

  const operador = await prisma.operadorLoja.findFirst({ where: { email, ativo: true }, select: { id: true, tenant: { select: { slug: true, status: true } } } });
  if (operador && operador.tenant.status !== "CANCELADA") {
    await abrirSessao(operador.tenant.slug, operador.id);
    return irPara("/painel");
  }

  const conta = await criarConta({ email, senha: null });
  if (!conta) return irPara("/entrar?google=falhou");
  await abrirSessao(conta.slug);
  return irPara("/painel");
}
