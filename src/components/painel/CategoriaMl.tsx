"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ChevronRight, Check, RefreshCw, Search, X } from "lucide-react";
import { inputClasse } from "./campos";

type Categoria = {
  categoriaId: string;
  categoriaNome: string;
  caminho: string[];
  folha: boolean;
  filhas: Array<{ categoriaId: string; categoriaNome: string }>;
};

type Sugerida = { categoriaId: string; categoriaNome: string; dominioNome: string; caminho?: string[] };
type Faltando = { id: string; nome: string; exigencia: string };

type Estado = {
  produto: { id: string; nome: string };
  categoriaId: string | null;
  origem: string;
  estado: string | null;
  sugerida: Sugerida | null;
  alternativas: Sugerida[];
  faltando: Faltando[];
};

const trilha = (c: { caminho?: string[]; categoriaNome: string }) =>
  c.caminho?.length ? c.caminho.join(" › ") : c.categoriaNome;

/**
 * Escolher a categoria do Mercado Livre de um produto.
 *
 * Existe porque o preparo mandava fazer exatamente isto — *"escolha a categoria
 * do Mercado Livre à mão"* — e não havia tela. A cobrança existia; o caminho,
 * não.
 *
 * É gaveta e não página: a pessoa está resolvendo uma lista de pendências, e
 * tirar ela da lista para escolher uma categoria por produto faria perder o
 * lugar a cada item. Sai daqui e volta para onde estava.
 *
 * Tudo funciona com a conta desconectada: busca, caminho e exigências vêm de
 * endpoint público do ML.
 */
export default function CategoriaMl({ produtoId, aoFechar, aoSalvar }: {
  produtoId: string;
  aoFechar: () => void;
  /** Avisa quem abriu que a pendência daquele produto mudou. */
  aoSalvar: () => void;
}) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [termo, setTermo] = useState("");
  const [achadas, setAchadas] = useState<Categoria[] | null>(null);
  const [escolhida, setEscolhida] = useState<Categoria | null>(null);
  const [salva, setSalva] = useState<{ categoria: Categoria; faltando: Faltando[]; estado: string } | null>(null);
  const [ocupado, setOcupado] = useState<"carregando" | "buscando" | "salvando" | null>("carregando");
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const r = await fetch(`/api/painel/canais/mercadolivre/categoria?produtoId=${encodeURIComponent(produtoId)}`);
        const d = await r.json();
        if (!r.ok) throw new Error(d.erro ?? "Não consegui abrir o produto.");
        if (vivo) setEstado(d as Estado);
      } catch (e) {
        if (vivo) setErro(e instanceof Error ? e.message : "Falha inesperada.");
      } finally {
        if (vivo) setOcupado(null);
      }
    })();
    return () => { vivo = false; };
  }, [produtoId]);

  // Esc fecha: é gaveta, e gaveta que só fecha no X prende quem usa teclado.
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => { if (e.key === "Escape") aoFechar(); };
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [aoFechar]);

  const buscar = useCallback(async (consulta: string, porId?: string) => {
    setErro(null);
    setOcupado("buscando");
    try {
      const p = porId ? `id=${encodeURIComponent(porId)}` : `q=${encodeURIComponent(consulta)}`;
      const r = await fetch(`/api/painel/canais/mercadolivre/categoria/buscar?${p}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro ?? "Busca falhou.");
      setAchadas(d.categorias as Categoria[]);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha inesperada.");
    } finally {
      setOcupado(null);
    }
  }, []);

  /** Descer numa categoria de agrupamento: o ML só publica em folha. */
  const descer = async (id: string) => {
    setEscolhida(null);
    const r = await fetch(`/api/painel/canais/mercadolivre/categoria/buscar?id=${encodeURIComponent(id)}`);
    const d = await r.json();
    if (!r.ok) return setErro(d.erro ?? "Falha.");
    const pai = (d.categorias as Categoria[])[0];
    const filhas = await Promise.all(
      pai.filhas.map(async (f) => {
        const rr = await fetch(`/api/painel/canais/mercadolivre/categoria/buscar?id=${encodeURIComponent(f.categoriaId)}`);
        const dd = await rr.json();
        return (dd.categorias as Categoria[] | undefined)?.[0] ?? null;
      }),
    );
    setAchadas(filhas.filter((f): f is Categoria => Boolean(f)));
  };

  async function salvar(categoriaId: string) {
    setErro(null);
    setOcupado("salvando");
    try {
      const r = await fetch("/api/painel/canais/mercadolivre/categoria", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ produtoId, categoriaId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro ?? "Não consegui salvar.");
      setSalva({ categoria: d.categoria, faltando: d.faltando ?? [], estado: d.estado });
      setEscolhida(null);
      setAchadas(null);
      aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha inesperada.");
    } finally {
      setOcupado(null);
    }
  }

  const bloqueiam = (salva?.faltando ?? []).filter((f) => f.exigencia !== "conditional_required");

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={aoFechar}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Categoria do Mercado Livre"
        className="flex h-full w-full max-w-md flex-col overflow-auto border-l border-border bg-background"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 border-b border-border p-4">
          <div className="min-w-0 flex-1">
            <small className="text-xs uppercase tracking-wide text-muted-foreground">Categoria do Mercado Livre</small>
            <h2 className="truncate text-base font-semibold">{estado?.produto.nome ?? "…"}</h2>
          </div>
          <button className="flex-none rounded-lg p-1 hover:bg-muted" onClick={aoFechar} aria-label="Fechar">
            <X size={18} />
          </button>
        </header>

        <div className="grid gap-4 p-4">
          {erro && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}

          {salva ? (
            <div className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
              <p className="flex items-center gap-2 text-sm font-medium text-emerald-800">
                <Check size={16} /> Categoria definida
              </p>
              <p className="text-sm">
                <b className="block">{salva.categoria.categoriaNome}</b>
                <span className="text-xs text-muted-foreground">{trilha(salva.categoria)}</span>
                <code className="mt-1 block text-xs text-muted-foreground">{salva.categoria.categoriaId}</code>
              </p>
              {bloqueiam.length > 0 ? (
                <div className="rounded-lg border border-border bg-background p-3">
                  <p className="text-sm font-medium">
                    Ainda {bloqueiam.length === 1 ? "falta 1 informação" : `faltam ${bloqueiam.length} informações`}
                  </p>
                  <ul className="mt-1 grid list-disc gap-0.5 pl-5 text-sm text-muted-foreground">
                    {bloqueiam.map((f) => <li key={f.id}>{f.nome}</li>)}
                  </ul>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Preencha no cadastro do produto. Sem elas o Mercado Livre recusa o anúncio.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-emerald-800">Nada mais falta neste produto. Ele já pode ser autorizado a publicar.</p>
              )}
              <button className="btn-secundario h-9 w-fit px-3 text-xs" onClick={() => setSalva(null)}>
                Escolher outra
              </button>
            </div>
          ) : (
            <>
              {estado?.categoriaId && (
                <div className="rounded-xl border border-border p-3 text-sm">
                  <small className="text-xs uppercase text-muted-foreground">
                    {estado.origem === "manual" ? "Escolhida por você" : "Sugestão automática"}
                  </small>
                  <b className="block">{estado.sugerida?.categoriaNome ?? estado.categoriaId}</b>
                  {estado.sugerida && <span className="text-xs text-muted-foreground">{trilha(estado.sugerida)}</span>}
                  <code className="mt-1 block text-xs text-muted-foreground">{estado.categoriaId}</code>
                  {estado.origem !== "manual" && (
                    <button
                      className="btn-secundario mt-2 h-8 px-3 text-xs"
                      disabled={Boolean(ocupado)}
                      onClick={() => salvar(estado.categoriaId!)}
                    >
                      Confirmar esta categoria
                    </button>
                  )}
                </div>
              )}

              {!estado?.categoriaId && ocupado !== "carregando" && (
                <p className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
                  <AlertTriangle size={15} className="mt-0.5 flex-none" />
                  O Mercado Livre não reconheceu o produto pelo nome. Procure a categoria abaixo — o nome técnico completo
                  costuma achar.
                </p>
              )}

              {(estado?.alternativas.length ?? 0) > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Também sugeridas</p>
                  <ul className="mt-1 grid gap-1">
                    {estado!.alternativas.map((a) => (
                      <li key={a.categoriaId}>
                        <button
                          className="w-full rounded-lg border border-border p-2 text-left text-sm hover:bg-muted/40"
                          disabled={Boolean(ocupado)}
                          onClick={() => salvar(a.categoriaId)}
                        >
                          <b className="block">{a.categoriaNome}</b>
                          <span className="text-xs text-muted-foreground">{trilha(a)} · {a.categoriaId}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <form
                onSubmit={(e) => { e.preventDefault(); void buscar(termo); }}
                className="grid gap-2"
              >
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground" htmlFor="busca-categoria">
                  Escolher outra categoria
                </label>
                <div className="flex gap-2">
                  <input
                    id="busca-categoria"
                    className={inputClasse}
                    placeholder="correia dentada, retentor, papelão…"
                    value={termo}
                    onChange={(e) => setTermo(e.target.value)}
                  />
                  <button className="btn-secundario inline-flex h-11 flex-none items-center gap-1.5 px-3 text-sm" disabled={Boolean(ocupado) || termo.trim().length < 3}>
                    {ocupado === "buscando" ? <RefreshCw size={15} className="animate-spin" /> : <Search size={15} />}
                    Buscar
                  </button>
                </div>
                <small className="text-xs text-muted-foreground">
                  Descreva o produto como ele é, não como está no seu cadastro: &quot;papelão hidráulico&quot; acha mais que &quot;PAP.HID 0,40&quot;.
                </small>
              </form>

              {achadas?.length === 0 && (
                <p className="text-sm text-muted-foreground">Nada encontrado. Tente outras palavras.</p>
              )}

              {achadas && achadas.length > 0 && (
                <ul className="grid gap-1">
                  {achadas.map((c) => (
                    <li key={c.categoriaId} className="rounded-lg border border-border">
                      <button
                        className="flex w-full items-center gap-2 p-3 text-left"
                        onClick={() => (c.folha ? setEscolhida(c) : void descer(c.categoriaId))}
                      >
                        <span className="min-w-0 flex-1 text-sm">
                          <b className="block">{c.categoriaNome}</b>
                          <span className="block text-xs text-muted-foreground">{trilha(c)}</span>
                          <code className="text-xs text-muted-foreground">{c.categoriaId}</code>
                        </span>
                        {!c.folha && <ChevronRight size={16} className="flex-none text-muted-foreground" />}
                      </button>
                      {escolhida?.categoriaId === c.categoriaId && (
                        <div className="border-t border-border p-3">
                          <button className="btn-primario inline-flex h-9 items-center gap-2 px-3 text-xs" disabled={Boolean(ocupado)} onClick={() => salvar(c.categoriaId)}>
                            {ocupado === "salvando" ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                            Usar esta categoria
                          </button>
                        </div>
                      )}
                      {!c.folha && (
                        <p className="border-t border-border px-3 py-2 text-xs text-muted-foreground">
                          Agrupa outras categorias — o Mercado Livre não publica aqui. Toque para ver as de dentro.
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
