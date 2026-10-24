import { responderDownloadDanfeFiscal } from "@/lib/fiscal-download";
import { exigir } from "@/lib/operadores";

export const runtime = "nodejs";
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { s, erro } = await exigir("fiscal");
  if (erro) return erro;
  const { id } = await params;
  return responderDownloadDanfeFiscal(s.tenant.id, id);
}
