import { fecharConta } from "@/lib/conta";

/** POST — sai da conta do comprador e volta para a loja. */
export async function POST(request: Request) {
  await fecharConta();
  return Response.redirect(new URL("/", request.url), 303);
}
