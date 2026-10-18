"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { AlertTriangle, CheckCircle2, CircleOff, Clock3, ExternalLink, RefreshCw, ShieldCheck, Unplug } from "lucide-react"
import type { CentralSaudeCanais, EstadoSaudeCanal } from "@/lib/saude-canais"

const APRESENTACAO: Record<EstadoSaudeCanal, { rotulo: string; classe: string; Icone: typeof CheckCircle2 }> = {
  saudavel: { rotulo: "Saudável", classe: "bg-emerald-50 text-emerald-700", Icone: CheckCircle2 },
  atencao: { rotulo: "Atenção", classe: "bg-amber-50 text-amber-800", Icone: AlertTriangle },
  erro: { rotulo: "Erro", classe: "bg-rose-50 text-rose-700", Icone: CircleOff },
  desconectado: { rotulo: "Desconectado", classe: "bg-slate-100 text-slate-600", Icone: Unplug },
  indisponivel: { rotulo: "Indisponível", classe: "bg-slate-100 text-slate-500", Icone: CircleOff },
}

const DESTINOS: Record<string, string> = {
  mercadolivre: "/painel/configuracoes/canais", amazon: "/painel/configuracoes/canais",
  shopee: "/painel/configuracoes/canais", magalu: "/painel/configuracoes/canais",
  "melhor-envio": "/painel/configuracoes/entrega", "webhooks-api": "/painel/ia",
}

function relativo(data: Date | string | null) {
  if (!data) return "Sem registro"
  const minutos = Math.max(0, Math.floor((Date.now() - new Date(data).getTime()) / 60_000))
  if (minutos < 1) return "Agora"
  if (minutos < 60) return `Há ${minutos} min`
  const horas = Math.floor(minutos / 60)
  return horas < 24 ? `Há ${horas} h` : `Há ${Math.floor(horas / 24)} d`
}

export default function CentralConexoes({ dados, podeTestar }: { dados: CentralSaudeCanais; podeTestar: boolean }) {
  const router = useRouter()
  const [testando, setTestando] = useState<string | null>(null)
  const [retorno, setRetorno] = useState<Record<string, string>>({})
  async function testar(canal: string) {
    setTestando(canal)
    const resposta = await fetch(`/api/painel/conexoes/${encodeURIComponent(canal)}/testar`, { method: "POST" })
    const corpo = await resposta.json().catch(() => ({ mensagem: "Não foi possível concluir o teste." }))
    setRetorno((atual) => ({ ...atual, [canal]: corpo.mensagem }))
    setTestando(null)
    router.refresh()
  }
  const criticos = dados.canais.filter((c) => c.estado === "erro").length
  const atencao = dados.canais.filter((c) => c.estado === "atencao").length
  return (
    <div className="space-y-5">
      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo da saúde">
        <div className="rounded-xl border border-slate-200 bg-white p-4"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Conexões</span><strong className="mt-1 block text-2xl text-slate-900">{dados.canais.length}</strong></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Precisam de atenção</span><strong className="mt-1 block text-2xl text-amber-700">{atencao}</strong></div>
        <div className="rounded-xl border border-slate-200 bg-white p-4"><span className="text-xs font-semibold uppercase tracking-wide text-slate-500">Erros críticos</span><strong className="mt-1 block text-2xl text-rose-700">{criticos}</strong></div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Canais conectados">
        {dados.canais.map((canal) => {
          const visual = APRESENTACAO[canal.estado]
          const destino = canal.id.startsWith("pagamento:") ? "/painel/configuracoes/recebimento" : DESTINOS[canal.id]
          const testavel = canal.id !== "webhooks-api" && canal.disponivel && (canal.conectado || canal.id.startsWith("pagamento:"))
          return <article key={canal.id} className="border-b border-slate-100 p-4 last:border-0 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-slate-950">{canal.nome}</h2>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${visual.classe}`}><visual.Icone size={13} />{visual.rotulo}</span>
                </div>
                <p className="mt-1 text-sm text-slate-600">{canal.conta ?? "Nenhuma conta identificada"}</p>
                <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><ShieldCheck size={14} />{canal.autenticacao} · {canal.escopos.join(", ")}</span>
                  <span className="inline-flex items-center gap-1"><Clock3 size={14} />Última atividade: {relativo(canal.ultimaAtividadeEm)}</span>
                  {canal.webhooks.total > 0 && <span>{canal.webhooks.ativos}/{canal.webhooks.total} webhooks ativos</span>}
                </div>
                {canal.limitacao && <p className="mt-3 text-xs font-medium text-slate-500">{canal.limitacao}</p>}
                {canal.alertas.map((alerta) => <p key={alerta.codigo} className="mt-2 text-sm text-amber-800">{alerta.mensagem}</p>)}
                {retorno[canal.id] && <p role="status" className="mt-2 text-sm font-medium text-slate-700">{retorno[canal.id]}</p>}
              </div>
              <div className="flex shrink-0 gap-2">
                {destino && <Link href={destino} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Gerenciar <ExternalLink size={14} /></Link>}
                {testavel && podeTestar && <button onClick={() => testar(canal.id)} disabled={testando === canal.id} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-slate-950 px-3 text-sm font-semibold text-white disabled:opacity-50"><RefreshCw size={14} className={testando === canal.id ? "animate-spin" : ""} />Testar</button>}
              </div>
            </div>
          </article>
        })}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h2 className="font-semibold text-slate-950">Histórico operacional</h2>
        <p className="mt-1 text-sm text-slate-500">Testes recentes, sem tokens nem respostas brutas dos provedores.</p>
        <ol className="mt-4 divide-y divide-slate-100">
          {dados.historico.length === 0 && <li className="py-5 text-sm text-slate-500">Nenhum teste registrado ainda.</li>}
          {dados.historico.map((evento) => <li key={evento.id} className="flex flex-col gap-1 py-3 text-sm sm:flex-row sm:items-center sm:justify-between"><span><strong className="text-slate-800">{evento.canal}</strong> · {evento.mensagem}</span><time className="text-xs text-slate-500">{relativo(evento.ocorridoEm)} · {evento.ator}</time></li>)}
        </ol>
      </section>
    </div>
  )
}
