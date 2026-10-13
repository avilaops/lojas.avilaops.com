import { exigir } from "@/lib/operadores";
import { confirmarPixManual, listarPixAConferir, pixManualLigado, recusarPixManual } from "@/lib/pix-manual";

/** A fila de Pix que o cliente disse que pagou. Sem nome, e-mail ou documento. */
export async function GET() {
  const { s, erro } = await exigir("pedidos");
  if (erro) return erro;
  if (!pixManualLigado(s.tenant)) return Response.json({ erro: "Este recurso não está ligado para esta loja." }, { status: 404 });
  return Response.json({ itens: await listarPixAConferir(s.tenant.id) });
}

export async function POST(request: Request) {
  const { s, erro } = await exigir("pedidos");
  if (erro) return erro;
  const corpo = (await request.json().catch(() => null)) as { referencia?: unknown; acao?: unknown } | null;
  const referencia = typeof corpo?.referencia === "string" ? corpo.referencia.trim() : "";
  const acao = corpo?.acao;
  if (!referencia || (acao !== "confirmar" && acao !== "nao_recebido")) {
    return Response.json({ erro: "Diga se o Pix chegou ou não." }, { status: 422 });
  }
  const r = acao === "confirmar"
    ? await confirmarPixManual(s.tenant, referencia)
    : await recusarPixManual(s.tenant, referencia);
  if (!r.ok) return Response.json({ erro: r.mensagem }, { status: r.status });
  return Response.json({ ok: true, mensagem: r.mensagem });
}
