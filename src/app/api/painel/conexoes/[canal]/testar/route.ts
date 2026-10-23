import { ErroSaudeCanal, testarCanal } from "@/lib/saude-canais"
import { exigir } from "@/lib/operadores"

export async function POST(_request: Request, { params }: { params: Promise<{ canal: string }> }) {
  const { s, erro } = await exigir("configuracoes")
  if (erro) return erro
  const { canal } = await params
  const ator = s.operador?.email ?? s.tenant.loginEmail ?? "dono-da-loja"
  try {
    const resultado = await testarCanal(s.tenant.id, decodeURIComponent(canal), ator)
    return Response.json(resultado, { status: resultado.ok ? 200 : 502 })
  } catch (falha) {
    if (falha instanceof ErroSaudeCanal) {
      return Response.json({ ok: false, codigo: falha.codigo, mensagem: falha.message }, { status: falha.codigo === "limite_temporario" ? 429 : 400 })
    }
    return Response.json({ ok: false, codigo: "falha_externa", mensagem: "Não foi possível concluir o teste." }, { status: 500 })
  }
}
