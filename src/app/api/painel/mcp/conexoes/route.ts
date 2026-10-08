import { conexoesDaLoja, revogarConexao } from "@/lib/mcp-conexoes";
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
