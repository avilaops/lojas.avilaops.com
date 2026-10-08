import { NextResponse } from "next/server";
import { clientePorId } from "@/lib/mcp-conexoes";
import { COOKIE_DO_PEDIDO, emissor, lerPedido, selarPedido, urlDeRetorno, VALIDADE } from "@/lib/mcp-oauth";
import { naoExiste, noDominioBase } from "@/lib/mcp-oauth-http";

export const dynamic = "force-dynamic";

/** Redirecionamento que depende de quem pediu: a borda não pode guardar. */
function ir(destino: string) {
  return NextResponse.redirect(destino, { status: 302, headers: { "cache-control": "no-store" } });
}

/**
 * A porta do login do conector: confere o pedido e leva o lojista à tela de
 * autorização (`/autorizar`, na plataforma).
 *
 * O pedido segue num cookie assinado, e não na URL, porque no meio do caminho
 * pode haver o login único em outro domínio: quem volta de lá cai no painel, e
 * o painel só sabe que havia uma autorização esperando pelo cookie.
 */
export async function GET(request: Request) {
  if (!noDominioBase(request)) return naoExiste();
  const params = new URL(request.url).searchParams;
  const cliente = await clientePorId(params.get("client_id"));
  const lido = lerPedido(params, cliente ? { id: cliente.id, retornos: cliente.retornos } : null);

  if (lido.tipo === "recusar") return ir(`${emissor()}/autorizar?recusa=${cliente ? "retorno" : "cliente"}`);
  if (lido.tipo === "devolver") {
    return ir(urlDeRetorno(lido.retorno, { error: lido.erro, error_description: lido.descricao, state: lido.state, iss: emissor() }));
  }

  const resposta = ir(`${emissor()}/autorizar`);
  resposta.cookies.set(COOKIE_DO_PEDIDO, selarPedido(lido.pedido), {
    httpOnly: true,
    // `lax`: o cookie precisa acompanhar a volta do login único, que é uma
    // navegação vinda de outro domínio.
    sameSite: "lax",
    secure: emissor().startsWith("https://"),
    path: "/",
    maxAge: Math.floor(VALIDADE.pedidoMs / 1000),
  });
  return resposta;
}
