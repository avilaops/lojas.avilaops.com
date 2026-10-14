import { exigir } from "@/lib/operadores";
import { lerComprovanteDoPix } from "@/lib/pix-manual";

/** O comprovante só sai para quem opera o pedido. Não é URL pública. */
export async function GET(_request: Request, { params }: { params: Promise<{ referencia: string }> }) {
  const { s, erro } = await exigir("pedidos");
  if (erro) return erro;
  const { referencia } = await params;
  const r = await lerComprovanteDoPix(s.tenant, referencia);
  if ("erro" in r) return Response.json({ erro: r.erro }, { status: r.status });
  return new Response(new Uint8Array(r.bytes), {
    headers: {
      "content-type": r.tipo,
      "content-disposition": "inline",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
