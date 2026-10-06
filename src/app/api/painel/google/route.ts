import { cookies, headers } from "next/headers";
import { COOKIE_ESTADO, googleConfigurado, novoEstado, urlDeAutorizacao } from "@/lib/google-entrada";

/** Leva ao Google. O estado vai num cookie curto e volta na URL: é o que impede alguém de plantar o retorno. */
export async function GET() {
  if (!googleConfigurado()) return new Response("Não encontrado.", { status: 404 });
  const estado = novoEstado();
  const h = await headers();
  const segura = (h.get("x-forwarded-proto") ?? "").split(",")[0].trim() === "https";
  (await cookies()).set(COOKIE_ESTADO, estado, { httpOnly: true, sameSite: "lax", secure: segura, path: "/api/painel/google", maxAge: 600 });
  // `new Response` e não `Response.redirect`: este tem cabeçalhos imutáveis, e
  // o cookie do estado precisa entrar na mesma resposta.
  return new Response(null, { status: 302, headers: { location: urlDeAutorizacao(estado) } });
}
