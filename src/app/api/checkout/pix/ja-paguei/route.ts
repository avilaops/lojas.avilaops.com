import { corpoAcimaDoTeto } from "@/lib/limites-upload";
import { informarPixPago } from "@/lib/pix-manual";
import { tenantAtual } from "@/lib/tenant";

const TETO = 5 * 1024 * 1024;

/** O comprador avisa que pagou. O comprovante é opcional e não é lido. */
export async function POST(request: Request) {
  const t = await tenantAtual();
  if (!t) return Response.json({ erro: "loja não encontrada" }, { status: 404 });
  if (corpoAcimaDoTeto(request, TETO)) {
    return Response.json({ erro: "O comprovante pode ter no máximo 5 MB." }, { status: 413 });
  }

  let referencia = "";
  let arquivo: { bytes: Buffer; tipo: string } | undefined;
  const tipo = request.headers.get("content-type") ?? "";
  if (tipo.includes("multipart/form-data")) {
    const form = await request.formData().catch(() => null);
    referencia = String(form?.get("referencia") ?? "").trim();
    const enviado = form?.get("comprovante");
    if (enviado instanceof File && enviado.size > 0) {
      arquivo = { bytes: Buffer.from(await enviado.arrayBuffer()), tipo: enviado.type };
    }
  } else {
    const corpo = (await request.json().catch(() => null)) as { referencia?: unknown } | null;
    referencia = typeof corpo?.referencia === "string" ? corpo.referencia.trim() : "";
  }
  if (referencia.length < 16) {
    return Response.json({ erro: "Não encontrei esse Pix." }, { status: 404 });
  }

  const r = await informarPixPago(t, referencia, arquivo);
  if (!r.ok) return Response.json({ erro: r.mensagem }, { status: r.status });
  return Response.json({ ok: true, mensagem: r.mensagem });
}
