import { buscarEndereco } from "@/lib/frete";

export async function GET(request: Request) {
  const cep = new URL(request.url).searchParams.get("cep") ?? "";
  const endereco = await buscarEndereco(cep);
  if (!endereco) return Response.json({ erro: "CEP não encontrado." }, { status: 404 });
  return Response.json(endereco);
}
