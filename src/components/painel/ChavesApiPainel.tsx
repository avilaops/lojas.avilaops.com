"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, ChevronDown, Copy, KeyRound, Plus, Trash2 } from "lucide-react";

/**
 * Chaves da API para desenvolvedores (`/api/v1`). Ver docs/API.md.
 *
 * A chave inteira aparece uma vez, logo depois de criada: o banco guarda só o
 * hash. A lista mostra começo e fim, o bastante para o lojista saber qual
 * integração está usando qual chave antes de revogar.
 *
 * A lista é de cartões, e não uma tabela: no celular a tabela passava da
 * largura da tela e o botão de revogar ficava fora dela. O formulário abre por
 * um botão quando a loja já tem chave, porque o que se vem fazer aqui, na
 * maioria das vezes, é conferir ou revogar.
 */

type Tipo = "SECRETA" | "PUBLICAVEL";

interface ChaveView {
  id: string;
  nome: string;
  tipo: Tipo;
  mascara: string;
  escopos: string[];
  origens: string[];
  criadaEm: string;
  ultimoUsoEm: string | null;
  revogadaEm: string | null;
}

interface Estado {
  podeSecreta: boolean;
  podeVender: boolean;
  escopos: Array<{ escopo: string; descricao: string }>;
  chaves: ChaveView[];
}

const ROTULO_TIPO: Record<Tipo, string> = { SECRETA: "Secreta", PUBLICAVEL: "Publicável" };

const data = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "nunca");
const dia = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");

/** A partir de quantas chaves a busca aparece: antes disso ela só ocupa espaço. */
const BUSCA_A_PARTIR_DE = 6;

export default function ChavesApiPainel() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState<Tipo>("PUBLICAVEL");
  const [escopos, setEscopos] = useState<string[]>(["loja:ler", "catalogo:ler"]);
  const [vende, setVende] = useState(false);
  const [sites, setSites] = useState("");
  const [nova, setNova] = useState<{ chave: string; nome: string } | null>(null);
  const [copiada, setCopiada] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [criando, setCriando] = useState(false);
  const [busca, setBusca] = useState("");

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
        body: JSON.stringify(
          tipo === "SECRETA"
            ? { nome, tipo, escopos }
            : { nome, tipo, escopos: vende ? ["vitrine:comprar"] : [], origens: vende ? sites.split(/\s+/).filter(Boolean) : [] },
        ),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Não foi possível criar a chave.");
      setNova({ chave: d.chave, nome: d.nome });
      setNome("");
      setCriando(false);
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

  const semChaves = Boolean(estado && estado.chaves.length === 0);
  const formularioAberto = criando || semChaves;
  const termo = busca.trim().toLowerCase();
  const visiveis = (estado?.chaves ?? []).filter((c) => !termo || `${c.nome} ${c.mascara} ${c.escopos.join(" ")}`.toLowerCase().includes(termo));

  return (
    <div className="grid min-w-0 gap-3">
      {erro && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-700">{erro}</div>}

      {nova && (
        <div className="min-w-0 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-amber-900">
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

      {estado && !formularioAberto && (
        <div className="flex min-w-0 items-center justify-between gap-3">
          <p className="min-w-0 text-xs text-muted-foreground">Para ERP, PDV, planilha, site ou app. Rotas em <code>/api/v1</code>.</p>
          <button type="button" onClick={() => setCriando(true)} className="btn-primario h-9 shrink-0 px-3 text-xs">
            <Plus className="mr-1 h-3.5 w-3.5" /> Nova chave
          </button>
        </div>
      )}

      {formularioAberto && (
      <form onSubmit={criar} className="grid min-w-0 gap-3 rounded-xl border border-border bg-card p-3 sm:p-4">
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
                <b>Secreta</b> (<code>lojas_sk_</code>): só no seu servidor. Pode o que você marcar nos escopos; com <code>mcp:usar</code>, serve também ao conector de IA.
                {estado && !estado.podeSecreta && " Recurso do plano Loja Pro."}
              </span>
            </label>
          </fieldset>
        </div>

        {tipo === "PUBLICAVEL" && estado && (
          <fieldset className="grid gap-2 text-xs">
            <legend className="mb-1 font-semibold text-foreground">Compra pelo site ou app próprio</legend>
            <label className={`flex items-start gap-2 ${estado.podeVender ? "" : "opacity-50"}`}>
              <input type="checkbox" checked={vende} disabled={!estado.podeVender} onChange={(e) => setVende(e.target.checked)} />
              <span>
                Permitir que esta chave feche compras (<code>vitrine:comprar</code>): cotar frete, criar o pedido e a cobrança.
                {!estado.podeVender && " Disponível quando a loja estiver recebendo pedidos, com o pagamento configurado."}
              </span>
            </label>
            {vende && (
              <label className="grid gap-1 font-semibold text-foreground">
                Sites que podem comprar com esta chave, um por linha
                <textarea
                  value={sites}
                  onChange={(e) => setSites(e.target.value)}
                  rows={2}
                  placeholder={"https://www.sualoja.com.br\nhttps://sualoja.com.br"}
                  className="rounded-lg border border-border bg-background px-3 py-2 font-mono text-xs font-normal"
                />
                <span className="font-normal text-muted-foreground">
                  Navegador em outro endereço é recusado. Deixe vazio só se a chave for de um aplicativo, que não tem endereço.
                </span>
              </label>
            )}
          </fieldset>
        )}

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

        <div className="flex flex-wrap gap-2">
          <button type="submit" disabled={ocupado} className="btn-primario h-10 px-4 text-xs">
            <KeyRound className="mr-1 h-3.5 w-3.5" /> Criar chave
          </button>
          {!semChaves && <button type="button" onClick={() => setCriando(false)} className="btn-secundario h-10 px-4 text-xs">Cancelar</button>}
        </div>
      </form>
      )}

      {estado && estado.chaves.length >= BUSCA_A_PARTIR_DE && (
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, chave ou escopo"
          aria-label="Buscar chave"
          className="h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 text-sm"
        />
      )}

      {estado && estado.chaves.length > 0 && (
        <ul className="min-w-0 divide-y divide-border rounded-xl border border-border bg-card">
          {visiveis.map((c) => (
            <li key={c.id} className={`min-w-0 ${c.revogadaEm ? "opacity-60" : ""}`}>
              <details className="group min-w-0">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 [&::-webkit-details-marker]:hidden">
                  <span className="min-w-0">
                    <span className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                      <span className="truncate">{c.nome}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${c.tipo === "SECRETA" ? "bg-foreground text-background" : "bg-muted text-foreground"}`}>{ROTULO_TIPO[c.tipo]}</span>
                      {c.revogadaEm && <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-800">revogada</span>}
                    </span>
                    <span className="block truncate font-mono text-[11px] text-muted-foreground">{c.mascara} · último uso: {data(c.ultimoUsoEm)}</span>
                  </span>
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="grid gap-2 px-3 pb-3">
                  {c.escopos.length > 0 && (
                    <p className="flex flex-wrap gap-1">
                      {c.escopos.map((e) => <code key={e} className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground">{e}</code>)}
                    </p>
                  )}
                  {c.origens.length > 0 && <p className="break-all font-mono text-[11px] text-muted-foreground">{c.origens.join(", ")}</p>}
                  <p className="text-[11px] text-muted-foreground">
                    Criada em {dia(c.criadaEm)}{c.revogadaEm ? ` · revogada em ${data(c.revogadaEm)}` : ""}
                  </p>
                  {!c.revogadaEm && (
                    <div>
                      <button type="button" onClick={() => revogar(c)} disabled={ocupado} className="btn-secundario h-9 px-3 text-xs text-red-600 hover:text-red-700">
                        <Trash2 className="mr-1 h-3.5 w-3.5" /> Revogar chave
                      </button>
                    </div>
                  )}
                </div>
              </details>
            </li>
          ))}
          {visiveis.length === 0 && <li className="px-3 py-2.5 text-xs text-muted-foreground">Nenhuma chave com esse termo.</li>}
        </ul>
      )}
      {estado && estado.chaves.length > 0 && (
        <p className="text-[11px] text-muted-foreground">A chave inteira só aparece ao criar. Perdeu? Revogue e crie outra.</p>
      )}
    </div>
  );
}
