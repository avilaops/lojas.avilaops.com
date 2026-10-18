import { consultarCnpj } from "@/lib/cnpj";
import { exigir } from "@/lib/operadores";
import { validarCnpj } from "@avilaops/checkout";

export async function GET(request: Request) {
  const { erro } = await exigir("configuracoes");
  if (erro) return erro;

  const cnpj = new URL(request.url).searchParams.get("cnpj")?.replace(/\D/g, "") ?? "";
  if (!validarCnpj(cnpj)) return Response.json({ erro: "Informe um CNPJ válido." }, { status: 422 });

  const dados = await consultarCnpj(cnpj);
  if (!dados) return Response.json({ erro: "Não foi possível localizar esse CNPJ agora." }, { status: 404 });
  return Response.json(dados);
}
