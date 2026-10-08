"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Trash2, Webhook } from "lucide-react";
import { Secao } from "./campos";

interface Entrega {
  id: string;
  tipo: string;
  status: string;
  tentativas: number;
  ultimoStatus: number | null;
  ultimoErro: string | null;
  criadaEm: string;
}

interface Item {
  id: string;
  nome: string;
  url: string;
  eventos: string[];
  ativo: boolean;
  desligadoMotivo: string | null;
  ultimaEntregaEm: string | null;
  entregas: Entrega[];
}

interface Estado {
  podeUsar: boolean;
  eventos: Array<{ tipo: string; descricao: string }>;
  webhooks: Item[];
}

const SITUACAO: Record<string, string> = { PENDENTE: "na fila", ENVIANDO: "enviando", ENTREGUE: "entregue", FALHOU: "não entregue" };

/**
 * Webhooks da API: o lojista cadastra o endereço do sistema dele e escolhe de
 * quais eventos de pedido quer ser avisado.
 *
 * A tela mostra as últimas entregas de cada um com o erro que o destino deu:
 * quem conserta o lado de lá é o lojista (ou quem programa para ele), e sem
 * isso ele só saberia que "não chegou".
 */
export default function WebhooksPainel() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [nome, setNome] = useState("");
  const [url, setUrl] = useState("");
  const [eventos, setEventos] = useState<string[]>(["pedido.pago"]);
  const [novo, setNovo] = useState<{ nome: string; segredo: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const carregar = useCallback(async () => {
    const r = await fetch("/api/painel/webhooks").catch(() => null);
    if (r?.ok) setEstado(await r.json());
  }, []);

  useEffect(() => {
    let vivo = true;
    fetch("/api/painel/webhooks")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (vivo && d) setEstado(d); })
      .catch(() => { /* A lista vazia é a apresentação segura. */ });
    return () => { vivo = false; };
  }, []);

  async function chamar(metodo: string, caminho: string, corpo?: unknown) {
    setErro(null);
    const r = await fetch(caminho, { method: metodo, ...(corpo ? { headers: { "content-type": "application/json" }, body: JSON.stringify(corpo) } : {}) });
    const d = await r.json().catch(() => null);
    if (!r.ok) throw new Error(d?.erro ?? "Não foi possível concluir.");
    return d;
  }

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setEnviando(true);
    try {
      const d = await chamar("POST", "/api/painel/webhooks", { nome, url, eventos });
      setNovo({ nome: d.nome, segredo: d.segredo });
      setNome("");
      setUrl("");
      await carregar();
    } catch (f) {
      setErro(f instanceof Error ? f.message : "Não foi possível criar.");
    } finally {
      setEnviando(false);
    }
  }

  async function apagar(w: Item) {
    if (!confirm(`Apagar o webhook "${w.nome}"? O sistema de destino para de ser avisado na hora.`)) return;
    try {
      await chamar("DELETE", `/api/painel/webhooks?id=${encodeURIComponent(w.id)}`);
      await carregar();
    } catch (f) {
      setErro(f instanceof Error ? f.message : "Não foi possível apagar.");
    }
  }

  async function religar(w: Item) {
    try {
      await chamar("PATCH", "/api/painel/webhooks", { id: w.id });
      await carregar();
    } catch (f) {
      setErro(f instanceof Error ? f.message : "Não foi possível religar.");
    }
  }

  const alternar = (tipo: string) => setEventos((atual) => (atual.includes(tipo) ? atual.filter((e) => e !== tipo) : [...atual, tipo]));
  const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <Secao
      titulo="Webhooks"
      descricao="Seu sistema é avisado quando um pedido é pago, enviado ou cancelado, em vez de ficar consultando. Cada aviso vai assinado."
    >
      {erro && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-600 dark:text-red-400">{erro}</div>}

      {estado && !estado.podeUsar && (
        <p className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">Webhooks da API são recurso do plano Loja Pro.</p>
      )}

      {novo && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
              Webhook &quot;{novo.nome}&quot; criado. Copie o segredo agora: ele não será exibido de novo.
            </span>
            <button
              type="button"
              onClick={() => { navigator.clipboard.writeText(novo.segredo); setCopiado(true); setTimeout(() => setCopiado(false), 2500); }}
              className="inline-flex items-center gap-1 text-xs font-bold text-primary underline"
            >
              {copiado ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiado ? "Copiado" : "Copiar segredo"}
            </button>
          </div>
          <div className="mt-2 select-all break-all rounded-lg border border-border bg-background p-2.5 font-mono text-xs font-bold text-foreground">{novo.segredo}</div>
          <p className="mt-2 text-[11px] text-amber-900 dark:text-amber-200">
            Use o segredo para conferir o cabeçalho <code>x-lojas-assinatura</code> de cada aviso. A conta está em /developers.
          </p>
        </div>
      )}

      {estado?.podeUsar && (
        <form onSubmit={criar} className="grid gap-4 rounded-xl border border-border bg-card p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1 text-xs font-semibold text-foreground">
              Nome
              <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ERP, planilha de pedidos" maxLength={60} required className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-foreground">
              Endereço que recebe os avisos
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://erp.suaempresa.com.br/webhooks/lojas" type="url" required className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal" />
            </label>
          </div>
          <fieldset className="grid gap-1.5 text-xs text-muted-foreground">
            <legend className="mb-1 font-semibold text-foreground">Avisar quando</legend>
            {estado.eventos.map((e) => (
              <label key={e.tipo} className="flex items-start gap-2">
                <input type="checkbox" checked={eventos.includes(e.tipo)} onChange={() => alternar(e.tipo)} />
                <span><code>{e.tipo}</code> {e.descricao}</span>
              </label>
            ))}
          </fieldset>
          <div>
            <button type="submit" disabled={enviando || eventos.length === 0} className="btn-primario h-9 px-4 text-xs">
              <Webhook className="mr-1 h-3.5 w-3.5" /> {enviando ? "Criando…" : "Criar webhook"}
            </button>
          </div>
        </form>
      )}

      {estado && estado.webhooks.length > 0 && (
        <ul className="grid gap-3">
          {estado.webhooks.map((w) => (
            <li key={w.id} className="rounded-xl border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">
                    {w.nome}{" "}
                    {!w.ativo && <span className="ml-1 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-800">desligado</span>}
                  </p>
                  <p className="break-all font-mono text-[11px] text-muted-foreground">{w.url}</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">{w.eventos.join(", ")}</p>
                </div>
                <div className="flex gap-2">
                  {!w.ativo && (
                    <button type="button" onClick={() => religar(w)} className="btn-secundario h-9 px-3 text-xs">Religar</button>
                  )}
                  <button type="button" onClick={() => apagar(w)} className="btn-secundario h-9 px-3 text-xs text-red-600 hover:text-red-700" title="Apagar webhook">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
              {w.desligadoMotivo && <p className="mt-2 rounded-lg bg-red-500/10 p-2 text-[11px] text-red-700 dark:text-red-300">{w.desligadoMotivo}</p>}
              {w.entregas.length === 0 ? (
                <p className="mt-3 text-[11px] text-muted-foreground">Nenhum aviso enviado ainda.</p>
              ) : (
                <ul className="mt-3 divide-y divide-border border-t border-border">
                  {w.entregas.map((e) => (
                    <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-x-3 py-1.5 text-[11px]">
                      <span>
                        <code className="text-foreground">{e.tipo}</code>{" "}
                        <span className={e.status === "ENTREGUE" ? "text-emerald-700" : e.status === "FALHOU" ? "text-red-600" : "text-muted-foreground"}>
                          {SITUACAO[e.status] ?? e.status}
                        </span>
                        {e.status !== "ENTREGUE" && e.ultimoErro && <span className="text-muted-foreground"> · {e.ultimoErro}</span>}
                        {e.tentativas > 1 && <span className="text-muted-foreground"> · {e.tentativas} tentativas</span>}
                      </span>
                      <span className="text-muted-foreground">{quando(e.criadaEm)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}
