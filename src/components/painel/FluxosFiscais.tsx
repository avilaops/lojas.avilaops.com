"use client";

import { useCallback, useEffect, useState } from "react";
import { CAMPOS_FISCAIS, EVENTOS_FISCAIS, FINALIDADES_FISCAIS } from "@/lib/fiscal-fluxos-contrato";
import { inputClasse, Secao } from "./campos";

type Configuracao = { nome: string; webhookId: string; finalidade: keyof typeof FINALIDADES_FISCAIS; eventos: string[]; campos: string[] };
type Fluxo = Configuracao & { id: string; ativo: boolean };
type Estado = {
  podeUsar: boolean;
  fluxos: Fluxo[];
  destinos: Array<{ id: string; nome: string; url: string; ativo: boolean }>;
  entregas: Array<{ id: string; eventId: string; webhookId: string; tipo: string; status: string; tentativas: number; ultimoErro: string | null; criadaEm: string; fluxoNome: string | null; documento: { id: string; numero: string | null; nsu: string } | null }>;
};
const INICIAL: Configuracao = { nome: "", webhookId: "", finalidade: "compras", eventos: ["fiscal.nfe-recebida"], campos: ["fornecedor", "totais"] };
const STATUS: Record<string, string> = { PENDENTE: "Na fila", ENVIANDO: "Enviando", ENTREGUE: "Recebido pelo destino", FALHOU: "Falhou" };

export default function FluxosFiscais({ documento }: { documento: { id: string; nsu: string; numero: string | null; chave: string | null } | null }) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [form, setForm] = useState<Configuracao>(INICIAL);
  const [editando, setEditando] = useState("");
  const [fluxoId, setFluxoId] = useState("");
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("");
  const [finalidade, setFinalidade] = useState("");
  const [statusEntrega, setStatusEntrega] = useState("");
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const carregar = useCallback(async () => {
    const r = await fetch("/api/painel/fiscal/fluxos", { cache: "no-store" });
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro ?? "Não foi possível carregar os fluxos.");
    setEstado(d);
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/painel/fiscal/fluxos", { cache: "no-store", signal: controller.signal }).then(async (r) => {
      const d = await r.json();
      if (!r.ok) throw new Error(d.erro ?? "Não foi possível carregar os fluxos.");
      setEstado(d);
    }).catch((e) => { if (e.name !== "AbortError") setErro(e.message); });
    return () => controller.abort();
  }, []);

  async function executar(acao: () => Promise<void>) {
    setOcupado(true); setErro(""); setMensagem("");
    try { await acao(); await carregar(); }
    catch (e) { setErro(e instanceof Error ? e.message : "Não foi possível concluir."); }
    finally { setOcupado(false); }
  }
  async function chamar(url: string, method: string, body: unknown) {
    const r = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json();
    if (!r.ok) throw new Error(d.erro ?? "Não foi possível concluir.");
    return d;
  }
  function alternar(campo: "eventos" | "campos", valor: string) {
    setForm((f) => ({ ...f, [campo]: f[campo].includes(valor) ? f[campo].filter((v) => v !== valor) : [...f[campo], valor] }));
  }
  const destino = (id: string) => estado?.destinos.find((d) => d.id === id);
  const acoes = (f: Fluxo) => <div className="mt-2 flex flex-wrap gap-3 text-xs">
    <button className="underline" disabled={ocupado || !estado?.podeUsar} onClick={() => { setEditando(f.id); setForm({ nome: f.nome, webhookId: f.webhookId, finalidade: f.finalidade, eventos: f.eventos, campos: f.campos }); }}>Editar</button>
    <button className="underline" disabled={ocupado} onClick={() => void executar(async () => { await chamar("/api/painel/fiscal/fluxos", "PATCH", { id: f.id, ativo: !f.ativo }); })}>{f.ativo ? "Pausar novos envios" : "Ativar"}</button>
  </div>;
  const fluxos = estado?.fluxos.filter((f) => (!situacao || (f.ativo ? "ativo" : "pausado") === situacao) && (!finalidade || f.finalidade === finalidade) && `${f.nome} ${destino(f.webhookId)?.nome ?? ""}`.toLocaleLowerCase("pt-BR").includes(busca.toLocaleLowerCase("pt-BR"))) ?? [];
  return (
    <div id="fluxos-fiscais" className="scroll-mt-6">
      <Secao titulo="Fluxos com dados fiscais" descricao="Escolha um destino já conectado e os dados que cada processo precisa receber.">
        {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
        {mensagem && <p role="status" className="text-sm text-emerald-700">{mensagem}</p>}
        <p className="text-sm text-muted-foreground">Os fluxos encaminham dados para conferência. Produtos, estoque e financeiro continuam sujeitos à aprovação no processo de destino.</p>
        {!estado ? <p role="status">Carregando fluxos…</p> : <>
          {!estado.podeUsar && <p className="text-sm text-muted-foreground">Integrações de servidor exigem o plano Loja Pro.</p>}
          {estado.podeUsar && !estado.destinos.some((d) => d.ativo) && <p className="text-sm">Nenhum destino ativo. Cadastre o endereço do fluxo em <a className="underline" href="/painel/ia#webhooks">Integrações da API</a> e configure a conferência da assinatura antes de ativar o processo.</p>}
          {estado.podeUsar && estado.destinos.some((d) => d.ativo) && <details open={!!editando || undefined} className="rounded-xl border border-border p-4">
            <summary className="cursor-pointer font-medium text-sm">{editando ? "Editar fluxo fiscal" : "Configurar fluxo fiscal"}</summary>
            <form className="mt-4 grid gap-4" onSubmit={(e) => { e.preventDefault(); void executar(async () => {
              await chamar("/api/painel/fiscal/fluxos", editando ? "PUT" : "POST", editando ? { id: editando, configuracao: form } : form);
              setForm(INICIAL); setEditando(""); setMensagem("Configuração salva. O fluxo será aplicado aos próximos documentos; para anteriores, selecione um documento na lista.");
            }); }}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1 text-sm">Nome<input className={inputClasse} required minLength={2} maxLength={60} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></label>
                <label className="grid gap-1 text-sm">Destino conectado<select className={inputClasse} required disabled={!!editando} value={form.webhookId} onChange={(e) => setForm({ ...form, webhookId: e.target.value })}>
                  <option value="">Selecione</option>{estado.destinos.filter((d) => d.ativo || d.id === form.webhookId).map((d) => <option key={d.id} value={d.id}>{d.nome}{d.ativo ? "" : " (desligado)"}</option>)}
                </select></label>
                <label className="grid gap-1 text-sm">Processo<select className={inputClasse} disabled={!!editando} value={form.finalidade} onChange={(e) => setForm({ ...form, finalidade: e.target.value as Configuracao["finalidade"], ...(e.target.value === "produtos" ? { eventos: ["fiscal.nfe-recebida"], campos: ["fornecedor", "itens"] } : {}) })}>
                  {Object.entries(FINALIDADES_FISCAIS).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
                </select></label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <fieldset className="grid gap-2 text-sm"><legend className="mb-2 font-medium">Quando receber</legend>{Object.entries(EVENTOS_FISCAIS).map(([id, nome]) => <label key={id} className="flex items-center gap-2"><input type="checkbox" checked={form.eventos.includes(id)} disabled={form.finalidade === "produtos" && id !== "fiscal.nfe-recebida"} onChange={() => alternar("eventos", id)} />{nome}</label>)}</fieldset>
                <fieldset className="grid gap-2 text-sm"><legend className="mb-2 font-medium">Dados enviados</legend>{Object.entries(CAMPOS_FISCAIS).map(([id, nome]) => <label key={id} className="flex items-center gap-2"><input type="checkbox" checked={form.campos.includes(id)} onChange={() => alternar("campos", id)} />{nome}</label>)}</fieldset>
              </div>
              <p className="text-xs text-muted-foreground">Chave, NSU e identificação acompanham o documento. Itens só ficam disponíveis no XML completo. As edições valem para novos envios; a fila já criada conserva os dados originais.</p>
              <div className="flex gap-2"><button className="btn-primario" disabled={ocupado || !form.eventos.length || !form.campos.length}>Salvar fluxo</button>{editando && <button type="button" className="btn-secundario" onClick={() => { setEditando(""); setForm(INICIAL); }}>Cancelar edição</button>}</div>
            </form>
          </details>}
          <div className="grid gap-2 sm:grid-cols-3">
            <label className="grid gap-1 text-xs">Buscar fluxo ou destino<input className={inputClasse} value={busca} onChange={(e) => setBusca(e.target.value)} /></label>
            <label className="grid gap-1 text-xs">Situação<select className={inputClasse} value={situacao} onChange={(e) => setSituacao(e.target.value)}><option value="">Todas</option><option value="ativo">Ativos</option><option value="pausado">Pausados</option></select></label>
            <label className="grid gap-1 text-xs">Processo<select className={inputClasse} value={finalidade} onChange={(e) => setFinalidade(e.target.value)}><option value="">Todos</option>{Object.entries(FINALIDADES_FISCAIS).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></label>
          </div>
          <ul className="grid gap-3 sm:hidden">{fluxos.map((f) => <li key={f.id} className="min-w-0 rounded-xl border border-border p-3 text-sm">
            <p className="break-words font-semibold">{f.nome}</p>
            <p className="mt-1 text-xs text-muted-foreground">{FINALIDADES_FISCAIS[f.finalidade]}</p>
            <dl className="mt-3 grid gap-2 text-xs"><div><dt className="font-medium">Destino</dt><dd className="break-words text-muted-foreground">{destino(f.webhookId)?.nome} · {destino(f.webhookId)?.ativo ? "Conectado" : "Desligado"}</dd></div>
              <div><dt className="font-medium">Eventos e dados</dt><dd className="text-muted-foreground">{f.eventos.map((v) => EVENTOS_FISCAIS[v as keyof typeof EVENTOS_FISCAIS]).join(" · ")}</dd><dd className="mt-1 text-muted-foreground">{f.campos.map((v) => CAMPOS_FISCAIS[v as keyof typeof CAMPOS_FISCAIS]).join(" · ")}</dd></div>
              <div><dt className="font-medium">Situação</dt><dd className="text-muted-foreground">{f.ativo ? "Ativo" : "Pausado para novos envios"}</dd></div>
            </dl>{acoes(f)}
          </li>)}{!fluxos.length && <li className="text-sm text-muted-foreground">Nenhum fluxo encontrado.</li>}</ul>
          <div className="hidden overflow-x-auto rounded-xl border border-border sm:block"><table className="w-full text-left text-sm">
            <thead className="bg-muted/40 text-xs"><tr><th className="p-3">Fluxo / processo</th><th className="p-3">Destino</th><th className="p-3">Eventos e dados</th><th className="p-3">Situação / ações</th></tr></thead>
            <tbody className="divide-y divide-border">{fluxos.map((f) => <tr key={f.id}>
              <td className="p-3"><strong>{f.nome}</strong><p className="text-xs text-muted-foreground">{FINALIDADES_FISCAIS[f.finalidade]}</p></td>
              <td className="p-3">{destino(f.webhookId)?.nome ?? "Destino removido"}<p className="text-xs text-muted-foreground">{destino(f.webhookId)?.ativo ? "Conectado" : "Desligado"}</p></td>
              <td className="p-3 text-xs"><p>{f.eventos.map((v) => EVENTOS_FISCAIS[v as keyof typeof EVENTOS_FISCAIS]).join(" · ")}</p><p className="mt-1 text-muted-foreground">{f.campos.map((v) => CAMPOS_FISCAIS[v as keyof typeof CAMPOS_FISCAIS]).join(" · ")}</p></td>
              <td className="p-3 text-xs"><p>{f.ativo ? "Ativo" : "Pausado para novos envios"}</p>{acoes(f)}</td>
            </tr>)}{!fluxos.length && <tr><td colSpan={4} className="p-4 text-muted-foreground">Nenhum fluxo encontrado.</td></tr>}</tbody>
          </table></div>
          {documento && estado.podeUsar && <form className="grid gap-3 rounded-xl border border-border p-4" onSubmit={(e) => { e.preventDefault(); void executar(async () => {
            const d = await chamar(`/api/painel/fiscal/documentos/${encodeURIComponent(documento.id)}/fluxos`, "POST", { fluxoId }); setMensagem(d.mensagem);
          }); }}>
            <p className="text-sm font-semibold">Encaminhar {documento.numero ? `nota ${documento.numero}` : "documento"} para conferência</p>
            <p className="break-all text-xs text-muted-foreground">NSU {documento.nsu}{documento.chave ? ` · Chave ${documento.chave}` : ""}</p>
            <label className="grid gap-1 text-sm">Fluxo<select className={inputClasse} required value={fluxoId} onChange={(e) => setFluxoId(e.target.value)}><option value="">Selecione</option>{estado.fluxos.filter((f) => f.ativo && destino(f.webhookId)?.ativo).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></label>
            <button className="btn-primario w-fit" disabled={ocupado || !fluxoId}>Confirmar encaminhamento</button>
          </form>}
          <details className="border-t border-border pt-4"><summary className="cursor-pointer text-sm font-medium">Últimas 30 entregas fiscais</summary>
            <div className="mt-3 flex flex-wrap items-end gap-2"><label className="grid gap-1 text-xs">Entrega<select className={inputClasse} value={statusEntrega} onChange={(e) => setStatusEntrega(e.target.value)}><option value="">Todas</option>{Object.entries(STATUS).map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}</select></label><button className="btn-secundario" disabled={ocupado} onClick={() => void executar(async () => {})}>Atualizar histórico</button></div>
            <ul className="mt-3 divide-y divide-border">{estado.entregas.filter((e) => !statusEntrega || e.status === statusEntrega).map((e) => <li key={e.id} className="grid gap-1 py-3 text-xs"><p>{e.fluxoNome} · {destino(e.webhookId)?.nome} · {STATUS[e.status] ?? e.status} · {e.tentativas} tentativa(s)</p><p>{new Date(e.criadaEm).toLocaleString("pt-BR")} · {EVENTOS_FISCAIS[e.tipo as keyof typeof EVENTOS_FISCAIS]}</p>{e.documento && <a className="underline" href={`/api/painel/fiscal/documentos/${e.documento.id}`}>Documento {e.documento.numero ?? "fiscal"} · NSU {e.documento.nsu}</a>}<p className="break-all text-muted-foreground">Evento {e.eventId} · Entrega {e.id}</p>{e.ultimoErro && <p className="text-red-700">{e.ultimoErro}</p>}</li>)}</ul>
            <p className="mt-2 text-xs text-muted-foreground">O aceite do destino confirma a entrega dos dados. O resultado da conferência e as aprovações são acompanhados no processo de destino. Histórico mantido por 30 dias; documentos já encaminhados continuam protegidos contra repetição.</p>
          </details>
        </>}
      </Secao>
    </div>
  );
}
