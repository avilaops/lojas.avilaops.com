"use client";

import { useState } from "react";
import { Star } from "lucide-react";

export interface AvaliacaoView { id: string; nome: string; nota: number; texto: string | null; criadoEm: string }

export function Estrelas({ nota, tamanho = "h-4 w-4" }: { nota: number; tamanho?: string }) {
  return (
    <span className="inline-flex" aria-label={`${nota} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`${tamanho} ${n <= Math.round(nota) ? "fill-amber-400 text-amber-400" : "text-border"}`} />)}
    </span>
  );
}

export default function Avaliacoes({ produtoId, avaliacoes, media, total }: { produtoId: string; avaliacoes: AvaliacaoView[]; media: number | null; total: number }) {
  const [f, setF] = useState({ nome: "", nota: 5, texto: "", site: "" });
  const [msg, setMsg] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aberto, setAberto] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null); setOcupado(true);
    try {
      const r = await fetch("/api/avaliacoes", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ produtoId, ...f, texto: f.texto || undefined }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Não foi possível enviar.");
      setMsg(d.mensagem); setAberto(false);
    } catch (x) {
      setErro(x instanceof Error ? x.message : "Falha.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-base font-bold">Avaliações</h2>
        {media != null ? <span className="flex items-center gap-2 text-sm"><Estrelas nota={media} /> {media.toFixed(1)} · {total} avaliação(ões)</span> : <span className="text-sm text-muted-foreground">Seja o primeiro a avaliar.</span>}
        <button className="btn-secundario ml-auto h-9 px-3 text-xs" onClick={() => setAberto((a) => !a)}>Avaliar produto</button>
      </div>

      {msg && <p className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">{msg}</p>}

      {aberto && (
        <form onSubmit={enviar} className="mt-4 grid gap-3 rounded-xl border border-border bg-card p-4">
          <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" onClick={() => setF({ ...f, nota: n })} aria-label={`${n} estrelas`}><Star className={`h-6 w-6 ${n <= f.nota ? "fill-amber-400 text-amber-400" : "text-border"}`} /></button>
            ))}
          </div>
          <input className="h-10 rounded-lg border border-border bg-background px-3 text-sm" placeholder="Seu nome" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} required maxLength={60} />
          <textarea className="h-24 rounded-lg border border-border bg-background p-3 text-sm" placeholder="Conte como foi (opcional)" value={f.texto} onChange={(e) => setF({ ...f, texto: e.target.value })} maxLength={1000} />
          <input type="text" name="site" value={f.site} onChange={(e) => setF({ ...f, site: e.target.value })} className="hidden" tabIndex={-1} autoComplete="off" aria-hidden />
          {erro && <p className="text-sm text-red-700">{erro}</p>}
          <button className="btn-primario" disabled={ocupado}>{ocupado ? "Enviando…" : "Enviar avaliação"}</button>
        </form>
      )}

      {avaliacoes.length > 0 && (
        <ul className="mt-4 divide-y divide-border">
          {avaliacoes.map((a) => (
            <li key={a.id} className="py-3">
              <div className="flex items-center gap-2 text-sm"><Estrelas nota={a.nota} /><span className="font-semibold">{a.nome}</span><span className="text-xs text-muted-foreground">{new Date(a.criadoEm).toLocaleDateString("pt-BR")}</span></div>
              {a.texto && <p className="mt-1 text-sm">{a.texto}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
