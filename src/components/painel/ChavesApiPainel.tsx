"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, Trash2 } from "lucide-react";
import { Secao } from "./campos";

/**
 * Chaves da API para desenvolvedores (`/api/v1`). Ver docs/API.md.
 *
 * A chave inteira aparece uma vez, logo depois de criada: o banco guarda só o
 * hash. A lista mostra começo e fim, o bastante para o lojista saber qual
 * integração está usando qual chave antes de revogar.
 */

type Tipo = "SECRETA" | "PUBLICAVEL";

interface ChaveView {
  id: string;
  nome: string;
  tipo: Tipo;
  mascara: string;
  escopos: string[];
  criadaEm: string;
  ultimoUsoEm: string | null;
  revogadaEm: string | null;
}

interface Estado {
  podeSecreta: boolean;
  escopos: Array<{ escopo: string; descricao: string }>;
  chaves: ChaveView[];
}

const ROTULO_TIPO: Record<Tipo, string> = { SECRETA: "Secreta", PUBLICAVEL: "Publicável" };

const data = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "nunca");

export default function ChavesApiPainel() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<Tipo>("PUBLICAVEL");
  const [escopos, setEscopos] = useState<string[]>(["loja:ler", "catalogo:ler"]);
  const [nova, setNova] = useState<{ chave: string; nome: string } | null>(null);
  const [copiada, setCopiada] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const r = await fetch("/api/painel/chaves");
    if (r.ok) setEstado(await r.json());
  }, []);

  useEffect(() => {
    async function inicial() {
      try {
        const r = await fetch("/api/painel/chaves");
        if (r.ok) setEstado(await r.json());
      } catch {
        /* Sem a lista, a tela mostra só o formulário: é o estado seguro. */
      }
    }
    inicial();
  }, []);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setOcupado(true);
    setErro(null);
    setNova(null);
    try {
      const r = await fetch("/api/painel/chaves", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nome, tipo, escopos: tipo === "SECRETA" ? escopos : [] }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Não foi possível criar a chave.");
      setNova({ chave: d.chave, nome: d.nome });
      setNome("");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível criar a chave.");
    } finally {
      setOcupado(false);
    }
  }

  async function revogar(c: ChaveView) {
    if (!confirm(`Revogar a chave "${c.nome}"? A integração que usa ${c.mascara} para de funcionar na hora.`)) return;
    setOcupado(true);
    setErro(null);
    try {
      const r = await fetch(`/api/painel/chaves/${c.id}`, { method: "DELETE" });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Não foi possível revogar.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível revogar.");
    } finally {
      setOcupado(false);
    }
  }

  function copiar(texto: string) {
    navigator.clipboard.writeText(texto);
    setCopiada(true);
    setTimeout(() => setCopiada(false), 2500);
  }

  const alternar = (escopo: string) =>
    setEscopos((atual) => (atual.includes(escopo) ? atual.filter((e) => e !== escopo) : [...atual, escopo]));

  return (
    <Secao
      titulo="API para desenvolvedores"
      descricao="Chaves para integrar a loja a um ERP, PDV, planilha ou a um site e app próprios. A documentação das rotas fica em /api/v1."
    >
      {erro && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-600 dark:text-red-400">{erro}</div>}

      {nova && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-amber-800 dark:text-amber-300">
              Chave &quot;{nova.nome}&quot; criada. Copie agora: ela não será exibida de novo.
            </span>
            <button type="button" onClick={() => copiar(nova.chave)} className="inline-flex items-center gap-1 text-xs font-bold text-primary underline">
              {copiada ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copiada ? "Copiada" : "Copiar chave"}
            </button>
          </div>
          <div className="mt-2 select-all break-all rounded-lg border border-border bg-background p-2.5 font-mono text-xs font-bold text-foreground">
            {nova.chave}
          </div>
        </div>
      )}

      <form onSubmit={criar} className="grid gap-4 rounded-xl border border-border bg-card p-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-xs font-semibold text-foreground">
            Nome da integração
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="ERP, App iOS, site institucional"
              maxLength={60}
              required
              className="h-10 rounded-lg border border-border bg-background px-3 text-sm font-normal"
            />
          </label>
          <fieldset className="grid gap-1 text-xs font-semibold text-foreground">
            <legend className="mb-1">Tipo</legend>
            <label className="flex items-start gap-2 font-normal">
              <input type="radio" name="tipo" checked={tipo === "PUBLICAVEL"} onChange={() => setTipo("PUBLICAVEL")} />
              <span><b>Publicável</b> (<code>lojas_pk_</code>): pode ir no site ou app. Só lê o que a vitrine já mostra.</span>
            </label>
            <label className={`flex items-start gap-2 font-normal ${estado && !estado.podeSecreta ? "opacity-50" : ""}`}>
              <input type="radio" name="tipo" checked={tipo === "SECRETA"} disabled={Boolean(estado && !estado.podeSecreta)} onChange={() => setTipo("SECRETA")} />
              <span>
                <b>Secreta</b> (<code>lojas_sk_</code>): só no seu servidor. Lê catálogo e pedidos.
                {estado && !estado.podeSecreta && " Recurso do plano Loja Pro."}
              </span>
            </label>
          </fieldset>
        </div>

        {tipo === "SECRETA" && estado && (
          <fieldset className="grid gap-2 text-xs">
            <legend className="mb-1 font-semibold text-foreground">O que a chave pode ler</legend>
            {estado.escopos
              .filter((e) => e.escopo !== "vitrine:ler")
              .map((e) => (
                <label key={e.escopo} className="flex items-start gap-2">
                  <input type="checkbox" checked={escopos.includes(e.escopo)} onChange={() => alternar(e.escopo)} />
                  <span><code>{e.escopo}</code> — {e.descricao}</span>
                </label>
              ))}
          </fieldset>
        )}

        <div>
          <button type="submit" disabled={ocupado} className="btn-primario h-10 px-4 text-xs">
            <KeyRound className="mr-1 h-3.5 w-3.5" /> Criar chave
          </button>
        </div>
      </form>

      {estado && estado.chaves.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="p-3">Nome</th>
                <th className="p-3">Chave</th>
                <th className="p-3">Escopos</th>
                <th className="p-3">Último uso</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {estado.chaves.map((c) => (
                <tr key={c.id} className={`border-t border-border ${c.revogadaEm ? "opacity-50" : ""}`}>
                  <td className="p-3 font-semibold text-foreground">
                    {c.nome}
                    <div className="font-normal text-muted-foreground">{ROTULO_TIPO[c.tipo]}</div>
                  </td>
                  <td className="p-3 font-mono">{c.mascara}</td>
                  <td className="p-3">{c.escopos.join(", ")}</td>
                  <td className="p-3">{c.revogadaEm ? `revogada em ${data(c.revogadaEm)}` : data(c.ultimoUsoEm)}</td>
                  <td className="p-3 text-right">
                    {!c.revogadaEm && (
                      <button type="button" onClick={() => revogar(c)} disabled={ocupado} className="btn-secundario h-8 px-2 text-red-600" title="Revogar chave">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Secao>
  );
}
