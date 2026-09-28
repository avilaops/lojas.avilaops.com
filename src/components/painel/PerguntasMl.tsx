"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircleQuestion, Send } from "lucide-react";

export type PerguntaMlView = {
  id: string;
  texto: string;
  autor: string | null;
  mlbId: string;
  perguntadaEm: string;
  motivoErro: string | null;
  produtoNome: string | null;
};

const QUANDO = (iso: string) => {
  const minutos = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.round(minutos / 60);
  return horas < 24 ? `há ${horas} h` : `há ${Math.round(horas / 24)} dias`;
};

/**
 * A fila de perguntas do Mercado Livre.
 *
 * Mostra o tempo desde que a pergunta chegou, e não a data: no Mercado Livre
 * quem pergunta está decidindo agora, e "há 3 h" cobra o que "17/09 09:12"
 * não cobra. A mais antiga vem primeiro, pelo mesmo motivo.
 */
export default function PerguntasMl({ perguntas }: { perguntas: PerguntaMlView[] }) {
  const router = useRouter();
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [enviando, setEnviando] = useState<string | null>(null);
  const [erros, setErros] = useState<Record<string, string>>({});

  async function responder(id: string) {
    setEnviando(id);
    setErros((e) => ({ ...e, [id]: "" }));
    try {
      const r = await fetch("/api/painel/canais/mercadolivre/perguntas", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ perguntaId: id, texto: textos[id] ?? "" }),
      });
      const corpo = (await r.json().catch(() => ({}))) as { erro?: string };
      if (!r.ok) throw new Error(corpo.erro ?? "Não consegui responder.");
      setTextos((t) => ({ ...t, [id]: "" }));
      router.refresh();
    } catch (e) {
      setErros((x) => ({ ...x, [id]: e instanceof Error ? e.message : "Não consegui responder." }));
    } finally {
      setEnviando(null);
    }
  }

  if (!perguntas.length) {
    return <p className="text-sm text-muted-foreground">Nenhuma pergunta esperando resposta.</p>;
  }

  return (
    <div className="grid gap-4">
      {perguntas.map((p) => (
        <article key={p.id} className="grid gap-3 rounded-xl border border-border p-4">
          <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <MessageCircleQuestion size={16} className="flex-none text-muted-foreground" />
            <strong className="text-sm">{p.produtoNome ?? p.mlbId}</strong>
            <span className="text-xs text-muted-foreground">
              {p.autor ?? "Comprador"} · {QUANDO(p.perguntadaEm)}
            </span>
          </header>
          <p className="text-sm">{p.texto}</p>
          {p.motivoErro && <p className="rounded-lg bg-amber-50 p-2 text-xs text-amber-900">{p.motivoErro}</p>}
          {erros[p.id] && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{erros[p.id]}</p>}
          <label className="grid gap-1.5 text-sm">
            <span className="sr-only">Resposta para {p.produtoNome ?? p.mlbId}</span>
            <textarea
              className="min-h-20 w-full rounded-lg border border-border bg-background p-2 text-sm"
              maxLength={2000}
              placeholder="Responda direto. Telefone, e-mail e link são recusados pelo Mercado Livre."
              value={textos[p.id] ?? ""}
              onChange={(e) => setTextos((t) => ({ ...t, [p.id]: e.target.value }))}
            />
          </label>
          <div className="flex items-center justify-between gap-3">
            <small className="text-xs text-muted-foreground">{(textos[p.id] ?? "").length}/2000</small>
            <button
              type="button"
              className="btn-primario inline-flex h-9 items-center gap-1.5 px-3 text-sm"
              disabled={enviando === p.id || !(textos[p.id] ?? "").trim()}
              onClick={() => responder(p.id)}
            >
              <Send size={15} /> {enviando === p.id ? "Enviando…" : "Responder"}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
