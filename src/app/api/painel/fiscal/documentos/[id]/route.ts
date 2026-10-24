import { responderDownloadXmlFiscal } from "@/lib/fiscal-download";
import { exigir } from "@/lib/operadores";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { s, erro } = await exigir("fiscal");
  if (erro) return erro;
  const { id } = await params;
  return responderDownloadXmlFiscal(s.tenant.id, id);
}
