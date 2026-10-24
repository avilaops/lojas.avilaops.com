import { responderDownloadFiscalErp } from "@/lib/fiscal-download";
import { exigir } from "@/lib/operadores";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string; formato: string }> }) {
  const { s, erro } = await exigir("fiscal");
  if (erro) return erro;
  const { id, formato } = await params;
  const cnpj = s.tenant.cnpj?.replace(/[^0-9A-Z]/gi, "").toUpperCase() ?? "";
  return responderDownloadFiscalErp(cnpj, id, formato);
}
