import { fecharSessao } from "@/lib/sessao";

export async function POST(request: Request) {
  await fecharSessao();
  return Response.redirect(new URL("/", request.url), 303);
}
