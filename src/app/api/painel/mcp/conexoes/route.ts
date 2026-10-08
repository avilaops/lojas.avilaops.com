import { alterarAcesso, conexoesDaLoja, revogarConexao } from "@/lib/mcp-conexoes";
import { escoposDaAutorizacao } from "@/lib/mcp-permissoes";
import { exigir } from "@/lib/operadores";

/** GET — os assistentes conectados à loja pelo login do conector. */
export async function GET() {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  return Response.json({ conexoes: await conexoesDaLoja(s.tenant.id) });
}

/** DELETE ?id= — desconecta um assistente. Vale na chamada seguinte dele. */
export async function DELETE(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!id || !(await revogarConexao(s.tenant.id, id))) {
    return Response.json({ erro: "Conexão não encontrada." }, { status: 404 });
  }
  return Response.json({ sucesso: true });
}

/**
 * PATCH { id, nivel, areas } — muda o que um assistente conectado pode.
 *
 * Mesma régua de conectar: quem mexe nas configurações da loja. Só o painel
 * chama isto; o assistente não tem como ampliar o próprio acesso.
 */
export async function PATCH(request: Request) {
  const { s, erro } = await exigir("configuracoes");
  if (erro) return erro;
  const corpo = (await request.json().catch(() => null)) as { id?: unknown; nivel?: unknown; areas?: unknown } | null;
  const id = typeof corpo?.id === "string" ? corpo.id : "";
  const escopos = escoposDaAutorizacao({ nivel: corpo?.nivel, areas: corpo?.areas });
  if (!escopos) return Response.json({ erro: "Escolha ao menos uma área para o assistente acessar." }, { status: 400 });
  if (!id || !(await alterarAcesso(s.tenant.id, id, escopos))) {
    return Response.json({ erro: "Conexão não encontrada." }, { status: 404 });
  }
  const conexao = (await conexoesDaLoja(s.tenant.id)).find((c) => c.id === id);
  return Response.json({ sucesso: true, conexao });
}
