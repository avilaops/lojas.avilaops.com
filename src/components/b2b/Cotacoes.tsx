"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { centavosDoFormulario } from "@/lib/cotacoes-b2b-form";

const input = "min-w-0 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const button = "rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:opacity-50";
const labels: Record<string, string> = { RASCUNHO: "Rascunho", EM_NEGOCIACAO: "Em negociação", AGUARDANDO_APROVACAO: "Aguardando aprovação", APROVADA: "Aprovada", RECUSADA: "Recusada", EXPIRADA: "Expirada", CANCELADA: "Cancelada", CONVERTIDA: "Convertida em pedido" };
const dinheiro = (value: number) => (value / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const valor = (value: number) => (value / 100).toFixed(2).replace(".", ",");
type Opcao = { id: string; nome: string; produtoId?: string };
type Item = { produtoId: string; varianteId: string; nome: string; quantidade: number; precoUnitarioCentavos: number };
type Versao = { numero: number; itens: Item[]; totalCentavos: number; descontoCentavos: number; freteCentavos: number; condicoes: Record<string, unknown>; justificativa: string | null };
type Cotacao = { id: string; referencia: string; estado: string; versaoAtual: number; validaAte: string; empresa: { razaoSocial: string }; versoes: Versao[]; pedido: { id: string; numero: number; referencia?: string } | null; pedidoId?: string; eventos?: Array<{ id: string; tipo: string; criadoEm: string }>; anexos?: Array<{ id: string; nome: string; url: string }> };
type Linha = { produtoId: string; varianteId: string; nome: string; quantidade: string; preco: string };

async function request<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal, ...(body === undefined ? {} : { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.erro === "string" ? data.erro : "Não foi possível concluir a operação.");
  return data as T;
}

function Seletor({ base, tipo, titulo, empresaId, selecionada, onChange, disabled = false }: { base: string; tipo: string; titulo: string; empresaId?: string; selecionada: Opcao | null; onChange: (value: Opcao | null) => void; disabled?: boolean }) {
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(1);
  const [data, setData] = useState<{ opcoes: Opcao[]; temProxima: boolean }>({ opcoes: [], temProxima: false });
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (disabled) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ tipo, busca, pagina: String(pagina), ...(empresaId ? { empresaId } : {}) });
    const timer = setTimeout(() => {
      request<typeof data>(`${base}/referencias?${params}`, undefined, controller.signal).then(value => { setData(value); setErro(""); })
        .catch(error => { if (!controller.signal.aborted) setErro(error instanceof Error ? error.message : "Falha na busca."); });
    }, 200);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [base, tipo, empresaId, busca, pagina, disabled]);
  return <div className="min-w-0 space-y-2">
    <label className="block text-sm font-medium">Buscar {titulo.toLowerCase()}
      <input className={input} type="search" value={busca} disabled={disabled} onChange={event => { setBusca(event.target.value); setPagina(1); }} />
    </label>
    <select className={input} aria-label={`Selecionar ${titulo.toLowerCase()}`} disabled={disabled} value={selecionada?.id ?? ""} onChange={event => onChange(data.opcoes.find(option => option.id === event.target.value) ?? null)}>
      <option value="">Selecione {titulo.toLowerCase()}</option>
      {selecionada && !data.opcoes.some(option => option.id === selecionada.id) && <option value={selecionada.id}>{selecionada.nome}</option>}
      {data.opcoes.map(option => <option key={option.id} value={option.id}>{option.nome}</option>)}
    </select>
    {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
    <div className="flex items-center gap-2 text-xs">
      <button type="button" className={button} disabled={disabled || pagina === 1} onClick={() => setPagina(value => value - 1)} aria-label={`Página anterior de ${titulo.toLowerCase()}`}>Anterior</button>
      <span>Página {pagina}</span>
      <button type="button" className={button} disabled={disabled || !data.temProxima} onClick={() => setPagina(value => value + 1)} aria-label={`Próxima página de ${titulo.toLowerCase()}`}>Próxima</button>
    </div>
  </div>;
}

function Formulario({ base, modo, email, cotacao, onSaved, onCancel }: { base: string; modo: "painel" | "conta"; email: string; cotacao?: Cotacao; onSaved: (id: string) => Promise<void>; onCancel: () => void }) {
  const ultima = cotacao?.versoes.find(version => version.numero === cotacao.versaoAtual);
  const [versaoEsperada] = useState(cotacao?.versaoAtual);
  const [empresa, setEmpresa] = useState<Opcao | null>(null);
  const [unidade, setUnidade] = useState<Opcao | null>(null);
  const [comprador, setComprador] = useState<Opcao | null>(null);
  const [centro, setCentro] = useState<Opcao | null>(null);
  const [itens, setItens] = useState<Linha[]>(ultima?.itens.map(item => ({ ...item, quantidade: String(item.quantidade), preco: valor(item.precoUnitarioCentavos) })) ?? []);
  const [desconto, setDesconto] = useState(valor(ultima?.descontoCentavos ?? 0));
  const [frete, setFrete] = useState(valor(ultima?.freteCentavos ?? 0));
  const [observacoes, setObservacoes] = useState(typeof ultima?.condicoes.observacoes === "string" ? ultima.condicoes.observacoes : "");
  const [justificativa, setJustificativa] = useState(ultima?.justificativa ?? "");
  const [validaAte, setValidaAte] = useState("");
  const [pedidoCompra, setPedidoCompra] = useState("");
  const [responsavelEmail, setResponsavelEmail] = useState(email);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  async function salvar(event: FormEvent) {
    event.preventDefault(); setBusy(true); setErro("");
    try {
      if (!itens.length) throw new Error("Adicione ao menos um produto.");
      const body = { itens: itens.map(item => {
        const quantidade = Number(item.quantidade);
        if (!Number.isSafeInteger(quantidade) || quantidade < 1) throw new Error("Informe uma quantidade inteira positiva.");
        return { produtoId: item.produtoId, varianteId: item.varianteId, quantidade, ...(item.preco.trim() ? { precoUnitarioCentavos: centavosDoFormulario(item.preco) } : {}) };
      }), descontoCentavos: centavosDoFormulario(desconto) ?? 0, freteCentavos: centavosDoFormulario(frete) ?? 0,
        condicoes: { ...ultima?.condicoes, observacoes }, justificativa: justificativa || null };
      let response: Cotacao;
      if (cotacao) response = await request<Cotacao>(`${base}/${encodeURIComponent(cotacao.id)}`, { ...body, acao: "contrapropor", versaoEsperada });
      else {
        if (!empresa || !comprador) throw new Error("Escolha a empresa e o comprador responsável.");
        response = await request<Cotacao>(base, { ...body, empresaId: empresa.id, compradorEmpresaId: comprador.id, unidadeId: unidade?.id ?? null,
          centroCustoId: centro?.id ?? null, pedidoCompra: pedidoCompra || null, validaAte: new Date(validaAte).toISOString(),
          ...(modo === "painel" ? { responsavelEmail } : {}) });
      }
      await onSaved(response.id);
    } catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível salvar."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={salvar} className="min-w-0 space-y-5 rounded-xl border border-border bg-card p-4">
    <h2 className="text-xl font-semibold">{cotacao ? "Nova contraproposta" : "Nova cotação"}</h2>
    <fieldset disabled={busy} className="min-w-0 space-y-5">
      {!cotacao && <>
        <Seletor base={base} tipo="empresas" titulo="Empresa" selecionada={empresa} onChange={value => { setEmpresa(value); setUnidade(null); setComprador(null); setCentro(null); setItens([]); }} />
        <div className="grid min-w-0 gap-4 md:grid-cols-3" key={empresa?.id ?? "sem-empresa"}>
          <Seletor base={base} tipo="unidades" titulo="Unidade" empresaId={empresa?.id} selecionada={unidade} onChange={setUnidade} disabled={!empresa} />
          <Seletor base={base} tipo="compradores" titulo="Comprador" empresaId={empresa?.id} selecionada={comprador} onChange={setComprador} disabled={!empresa} />
          <Seletor base={base} tipo="centros" titulo="Centro de custo" empresaId={empresa?.id} selecionada={centro} onChange={setCentro} disabled={!empresa} />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="block text-sm">Validade<input className={input} type="datetime-local" required value={validaAte} onChange={event => setValidaAte(event.target.value)} /></label>
          <label className="block text-sm">Ordem de compra<input className={input} maxLength={160} value={pedidoCompra} onChange={event => setPedidoCompra(event.target.value)} /></label>
          {modo === "painel" && <label className="block text-sm">E-mail do responsável<input className={input} type="email" required value={responsavelEmail} onChange={event => setResponsavelEmail(event.target.value)} /></label>}
        </div>
      </>}
      {!cotacao && <Seletor key={`produtos-${empresa?.id ?? ""}`} base={base} tipo="produtos" titulo="Produto" empresaId={empresa?.id} selecionada={null} disabled={!empresa || itens.length >= 500} onChange={option => {
        if (option?.produtoId && !itens.some(item => item.varianteId === option.id)) setItens(current => [...current, { produtoId: option.produtoId!, varianteId: option.id, nome: option.nome, quantidade: "1", preco: "" }]);
      }} />}
      <p className="text-sm text-muted-foreground">Deixe o preço vazio para usar as condições vigentes da empresa ao salvar.</p>
      {itens.map((item, index) => <div key={item.varianteId} className="grid min-w-0 gap-3 rounded-lg border border-border p-3 md:grid-cols-3">
        <p className="break-words font-medium md:col-span-3">{item.nome}</p>
        <label className="text-sm">Quantidade<input aria-label={`Quantidade do item ${index + 1}`} className={input} type="number" min={1} step={1} required value={item.quantidade} onChange={event => setItens(current => current.map((row, position) => position === index ? { ...row, quantidade: event.target.value } : row))} /></label>
        <label className="text-sm">Preço unitário (R$)<input aria-label={`Preço do item ${index + 1}`} className={input} inputMode="decimal" placeholder="Preço do catálogo" value={item.preco} onChange={event => setItens(current => current.map((row, position) => position === index ? { ...row, preco: event.target.value } : row))} /></label>
        <button type="button" className={button} onClick={() => setItens(current => current.filter((_, position) => position !== index))} aria-label={`Remover item ${index + 1}`}>Remover</button>
      </div>)}
      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-sm">Desconto (R$)<input className={input} inputMode="decimal" value={desconto} onChange={event => setDesconto(event.target.value)} /></label>
        <label className="text-sm">Frete (R$)<input className={input} inputMode="decimal" value={frete} onChange={event => setFrete(event.target.value)} /></label>
      </div>
      <label className="block text-sm">Condições comerciais<textarea className={input} value={observacoes} onChange={event => setObservacoes(event.target.value)} /></label>
      <label className="block text-sm">Justificativa da negociação<textarea className={input} maxLength={2000} value={justificativa} onChange={event => setJustificativa(event.target.value)} /></label>
      <p className="text-sm text-muted-foreground">Desconto ou preço negociado exigem justificativa e aprovação administrativa da empresa compradora.</p>
      {erro && <p role="alert" className="text-sm text-red-700">{erro}</p>}
      <div className="flex flex-wrap gap-3"><button className={button} type="submit">{busy ? "Salvando…" : cotacao ? "Salvar contraproposta" : "Criar cotação"}</button><button className={button} type="button" onClick={onCancel}>Descartar edição</button></div>
    </fieldset>
  </form>;
}

export default function Cotacoes({ modo, email, inicial }: { modo: "painel" | "conta"; email: string; inicial?: string }) {
  const base = `/api/${modo}/cotacoes-b2b`;
  const [lista, setLista] = useState<{ cotacoes: Cotacao[]; temProxima: boolean }>({ cotacoes: [], temProxima: false });
  const [cotacao, setCotacao] = useState<Cotacao | null>(null);
  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState("");
  const [estado, setEstado] = useState("");
  const [revision, setRevision] = useState(0);
  const [editar, setEditar] = useState(false);
  const [nova, setNova] = useState(false);
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState("");
  const [motivo, setMotivo] = useState("");
  const [novaValidade, setNovaValidade] = useState("");
  const abertura = useRef(0);
  const abrir = useCallback(async (id: string) => {
    const sequencia = ++abertura.current;
    const value = await request<Cotacao>(`${base}/${encodeURIComponent(id)}`);
    if (sequencia !== abertura.current) return;
    setCotacao(value); setErro("");
    const url = new URL(window.location.href); url.searchParams.set("cotacao", id); window.history.replaceState(null, "", url);
  }, [base]);
  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ pagina: String(pagina), busca, ...(estado ? { estado } : {}) });
    request<typeof lista>(`${base}?${params}`, undefined, controller.signal).then(setLista)
      .catch(error => { if (!controller.signal.aborted) setErro(error instanceof Error ? error.message : "Falha ao listar."); });
    return () => controller.abort();
  }, [base, pagina, busca, estado, revision]);
  useEffect(() => { if (inicial) void abrir(inicial).catch(error => setErro(error instanceof Error ? error.message : "Cotação indisponível.")); }, [inicial, abrir]);
  async function acao(value: string) {
    if (!cotacao) return;
    setBusy(true); setErro("");
    try {
      if (value === "recusar" && !motivo.trim()) throw new Error("Informe o motivo da recusa.");
      const result = await request<{ id: string }>(`${base}/${encodeURIComponent(cotacao.id)}`, {
        acao: value, ...(value === "recomprar" ? { validaAte: new Date(novaValidade).toISOString() } : { versaoEsperada: cotacao.versaoAtual }),
        ...(["cancelar", "recusar"].includes(value) ? { motivo } : {}),
        ...(value === "converter" ? { chaveIdempotencia: `cotacao-ui-${cotacao.id}` } : {}),
      });
      await abrir(value === "recomprar" ? result.id : cotacao.id); setRevision(current => current + 1);
    } catch (error) { setErro(error instanceof Error ? error.message : "Não foi possível concluir."); }
    finally { setBusy(false); }
  }
  const ultima = cotacao?.versoes.find(version => version.numero === cotacao.versaoAtual);
  const vencida = !!cotacao && new Date(cotacao.validaAte).getTime() <= Date.now();
  const terminal = !!cotacao && ["CANCELADA", "EXPIRADA", "RECUSADA", "CONVERTIDA"].includes(cotacao.estado);
  return <div className="min-w-0 space-y-6">
    <div className="flex flex-wrap gap-3"><button className={button} type="button" onClick={() => { setNova(true); setEditar(false); }}>Nova cotação</button><button className={button} type="button" onClick={() => { setRevision(current => current + 1); if (cotacao) void abrir(cotacao.id).catch(error => setErro(error.message)); }}>Recarregar cotações</button></div>
    {nova && <Formulario base={base} modo={modo} email={email} onCancel={() => setNova(false)} onSaved={async id => { await abrir(id); setNova(false); setRevision(current => current + 1); }} />}
    {erro && <p role="alert" className="rounded-lg border border-red-300 p-3 text-sm text-red-700">{erro}</p>}
    <div className="grid gap-3 md:grid-cols-2"><label className="text-sm">Buscar cotações<input type="search" className={input} value={busca} onChange={event => { setBusca(event.target.value); setPagina(1); }} /></label><label className="text-sm">Situação<select className={input} value={estado} onChange={event => { setEstado(event.target.value); setPagina(1); }}><option value="">Todas</option>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label></div>
    {!lista.cotacoes.length ? <p className="text-sm text-muted-foreground">Nenhuma cotação encontrada para os filtros atuais.</p> : <ul className="grid min-w-0 gap-3 md:grid-cols-2">{lista.cotacoes.map(row => <li key={row.id} className="min-w-0 rounded-xl border border-border p-4"><p className="break-words font-semibold">{row.empresa.razaoSocial}</p><p className="break-all text-xs">{row.referencia}</p><p className="my-2 text-sm">{labels[row.estado]} · {dinheiro(row.versoes[0]?.totalCentavos ?? 0)}</p><button className={button} onClick={() => { setEditar(false); void abrir(row.id).catch(error => setErro(error.message)); }}>Abrir cotação</button></li>)}</ul>}
    <div className="flex items-center gap-3"><button className={button} disabled={pagina === 1} onClick={() => setPagina(current => current - 1)}>Página anterior</button><span className="text-sm">Página {pagina}</span><button className={button} disabled={!lista.temProxima} onClick={() => setPagina(current => current + 1)}>Próxima página</button></div>
    {cotacao && <section className="min-w-0 space-y-4 rounded-xl border border-border bg-card p-4" aria-label="Detalhes da cotação">
      <h2 className="text-xl font-semibold">Cotação</h2><p className="break-all text-sm">{cotacao.referencia}</p>
      <p>{cotacao.empresa.razaoSocial} · <strong>{labels[cotacao.estado]}</strong></p>
      <p className="text-sm">Versão {cotacao.versaoAtual} · Validade: {new Date(cotacao.validaAte).toLocaleString("pt-BR")}</p>
      {vencida && !terminal && <p role="status">Prazo vencido. Ações comerciais indisponíveis.</p>}
      <ul className="space-y-2">{ultima?.itens.map((item, index) => <li className="break-words text-sm" key={`${item.varianteId}-${index}`}>{item.quantidade} × {item.nome} · {dinheiro(item.precoUnitarioCentavos)}</li>)}</ul>
      <p className="text-lg font-bold">{ultima ? `Total: ${dinheiro(ultima.totalCentavos)}` : "Total indisponível"}</p>
      {ultima?.condicoes && <dl className="space-y-1 text-sm">{Object.entries(ultima.condicoes).map(([key, value]) => <div key={key} className="break-words"><dt className="font-semibold">{key}</dt><dd>{typeof value === "string" ? value : JSON.stringify(value)}</dd></div>)}</dl>}
      {ultima?.justificativa && <p className="break-words text-sm">Justificativa: {ultima.justificativa}</p>}
      <fieldset disabled={busy} className="min-w-0 space-y-3">
        {!terminal && !vencida && <div className="flex flex-wrap gap-3">
          {["RASCUNHO", "EM_NEGOCIACAO"].includes(cotacao.estado) && <><button className={button} onClick={() => setEditar(true)}>Negociar</button><button className={button} onClick={() => void acao("submeter")}>Enviar para aprovação</button></>}
          {modo === "conta" && cotacao.estado === "AGUARDANDO_APROVACAO" && <><button className={button} onClick={() => void acao("aprovar")}>Aprovar cotação</button><button className={button} onClick={() => void acao("recusar")}>Recusar cotação</button></>}
          {modo === "painel" && cotacao.estado === "APROVADA" && <button className={button} onClick={() => void acao("converter")}>Converter em pedido</button>}
          <button className={button} onClick={() => void acao("cancelar")}>Cancelar cotação</button>
        </div>}
        {!terminal && <label className="block text-sm">Motivo da recusa ou cancelamento<textarea className={input} maxLength={2000} value={motivo} onChange={event => setMotivo(event.target.value)} /></label>}
        {cotacao.estado === "CONVERTIDA" && <div className="space-y-2"><label className="block text-sm">Validade da recompra<input className={input} type="datetime-local" value={novaValidade} onChange={event => setNovaValidade(event.target.value)} /></label><button className={button} disabled={!novaValidade} onClick={() => void acao("recomprar")}>Criar nova cotação com preços atuais</button></div>}
      </fieldset>
      {editar && <Formulario base={base} modo={modo} email={email} cotacao={cotacao} onCancel={() => setEditar(false)} onSaved={async id => { await abrir(id); setEditar(false); setRevision(current => current + 1); }} />}
      {cotacao.pedido && <Link className="inline-block underline" href={modo === "painel" ? `/painel/pedidos/${cotacao.pedido.id}` : `/pedido/${cotacao.pedido.referencia}`}>Abrir pedido #{cotacao.pedido.numero}</Link>}
      <details><summary className="cursor-pointer font-medium">Versões e histórico</summary><ul className="mt-3 space-y-2 text-sm">{cotacao.versoes.map(version => <li key={version.numero}>Versão {version.numero} · {dinheiro(version.totalCentavos)}</li>)}{cotacao.eventos?.map(event => <li key={event.id}>{event.tipo} · {new Date(event.criadoEm).toLocaleString("pt-BR")}</li>)}</ul></details>
      {!!cotacao.anexos?.length && <ul>{cotacao.anexos.map(file => <li key={file.id}>{/^https:\/\//i.test(file.url) ? <a className="underline" href={file.url} rel="noopener noreferrer" target="_blank">{file.nome}</a> : <span>{file.nome} · endereço indisponível</span>}</li>)}</ul>}
    </section>}
  </div>;
}
