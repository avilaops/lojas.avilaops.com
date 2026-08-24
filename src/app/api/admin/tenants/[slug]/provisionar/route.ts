import { autorizado, naoAutorizado } from "@/lib/admin-auth";
import { provisionarLoja } from "@/lib/provisionar";

type Ctx = { params: Promise<{ slug: string }> };

/** POST — (re)executa DNS + e-mail + n8n. Idempotente: pode rodar quantas vezes precisar. */
export async function POST(request: Request, { params }: Ctx) {
  if (!autorizado(request)) return naoAutorizado();
  const { slug } = await params;
  try {
    return Response.json(await provisionarLoja(slug));
  } catch {
    return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  }
}
