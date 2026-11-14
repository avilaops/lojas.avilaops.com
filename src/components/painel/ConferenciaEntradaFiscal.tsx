"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ConferenciaEntradaFiscal, ReciboEntradaFiscal } from "@/lib/fiscal-entrada";
import type { ItemNotaEntrada } from "@/lib/fiscal-entrada-xml";
import { inputClasse } from "./campos";
import { ROTULOS_RECEBIMENTO } from "@/lib/fiscal-acompanhamento-estado";

type Variante = { id: string; nome: string; variacao: string; sku: string | null; gtin: string | null };
type Linha = { numero: number; variante: Variante | null; quantidade: string };
const quantidadeInicial = (item: ItemNotaEntrada) => /^(UN|UND|UNID|UNIDADE|PC|PÇ|PECA|PEÇA)$/i.test(item.unidade) && Number.isInteger(Number(item.quantidade)) ? String(Number(item.quantidade)) : "";
const valor = (bruto: string) => {
  const [inteiro, fracao = ""] = bruto.split(".");
  return `${inteiro.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fracao.padEnd(2, "0")}`;
};

export default function ConferenciaEntradaFiscal({ documentoId, fechar }: { documentoId: string; fechar: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null), titulo = useId();
  const [estado, setEstado] = useState<ConferenciaEntradaFiscal | null>(null);
  const [recibo, setRecibo] = useState<ReciboEntradaFiscal | null>(null);
  const [erro, setErro] = useState("");
  const [itens, setItens] = useState<Linha[]>([]);
  const [local, setLocal] = useState("principal"), [locais, setLocais] = useState(["principal"]);
  const [conferido, setConferido] = useState(false), [enviando, setEnviando] = useState(false);
  const [acao, setAcao] = useState<"ciencia" | "documentos" | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [agora, setAgora] = useState(() => Date.now());
  const locaisId = useId();
  const carregar = useCallback(async (signal?: AbortSignal) => {
    const r = await fetch(`/api/painel/fiscal/documentos/${documentoId}/entrada-estoque`, { signal, cache: "no-store" });
    const dados = await r.json();
    if (!r.ok) throw new Error(dados.erro ?? "Não foi possível abrir a nota.");
    const conferencia = dados as ConferenciaEntradaFiscal;
    setEstado(conferencia); setRecibo(conferencia.recibo);
    setItens(conferencia.nota?.itens.map(item => ({ numero: item.numero, variante: null, quantidade: quantidadeInicial(item) })) ?? []);
    setConferido(false);
  }, [documentoId]);
  useEffect(() => {
    const elemento = dialog.current!;
    elemento.showModal();
    return () => elemento.close();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void carregar(controller.signal).catch(e => { if (e.name !== "AbortError") setErro(e.message); });
    void fetch("/api/painel/fiscal/entrada-estoque/variantes", { signal: controller.signal }).then(r => r.ok ? r.json() : null).then(dados => { if (dados?.locais) setLocais(dados.locais); }).catch(() => {});
    return () => controller.abort();
  }, [carregar]);
  useEffect(() => {
    const timer = setInterval(() => setAgora(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, []);
  async function atualizarDocumentos(ciencia = false) {
    if (acao || enviando) return;
    if (ciencia && !window.confirm("Confirma o envio real de Ciência da Emissão à SEFAZ? Isso registra seu conhecimento da emissão e não confirma a compra.")) return;
    setAcao(ciencia ? "ciencia" : "documentos"); setErro(""); setMensagem("");
    try {
      const url = ciencia ? `/api/painel/fiscal/documentos/${documentoId}/manifestacao` : "/api/painel/fiscal?acao=consultar";
      const r = await fetch(url, { method: "POST", ...(ciencia ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo: "CIENCIA", confirmacao: true }) } : {}) });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados.erro ?? "Não foi possível atualizar os documentos.");
      setMensagem(ciencia ? (dados.aceita ? `Ciência aceita • protocolo ${dados.protocolo}. O XML será acompanhado nas próximas consultas.` : "O resultado da manifestação ainda exige conferência. Nenhum reenvio automático será feito.") : "Documentos atualizados. Confira o estado desta nota.");
      await carregar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível atualizar os documentos.");
      await carregar().catch(() => {});
    } finally { setAgora(Date.now()); setAcao(null); }
  }
  function mudar(numero: number, mudanca: Partial<Linha>) {
    setItens(antes => antes.map(item => item.numero === numero ? { ...item, ...mudanca } : item));
    setConferido(false);
  }
  const valido = itens.length > 0 && itens.every(i => i.variante && /^\d+$/.test(i.quantidade) && Number(i.quantidade) >= 1 && Number(i.quantidade) <= 10_000_000) && /^[a-z0-9][a-z0-9_-]{0,79}$/.test(local);
  async function confirmar() {
    if (!valido || !conferido || enviando || estado?.impedimento || recibo) return;
    setEnviando(true); setErro("");
    try {
      const r = await fetch(`/api/painel/fiscal/documentos/${documentoId}/entrada-estoque`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmacao: true, local, itens: itens.map(i => ({ numero: i.numero, varianteId: i.variante!.id, quantidade: Number(i.quantidade) })) }) });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados.erro ?? "Não foi possível confirmar. Reabra a nota para consultar o recibo antes de tentar novamente.");
      setRecibo(dados);
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha na confirmação. Reabra a nota para consultar o recibo."); }
    finally { setEnviando(false); }
  }
  return <dialog ref={dialog} aria-labelledby={titulo} onCancel={e => { if (enviando || acao) e.preventDefault(); else fechar(); }} className="m-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-border bg-background p-4 text-foreground shadow-xl backdrop:bg-black/50 sm:p-6">
    <div className="mb-4 flex items-start justify-between gap-3"><h2 id={titulo} className="text-lg font-semibold">Conferir entrada de estoque</h2><button type="button" className="btn-secundario shrink-0" onClick={fechar} disabled={enviando || Boolean(acao)}>Fechar</button></div>
    {erro && <p role="alert" className="mb-4 rounded-xl bg-red-50 p-3 text-sm text-red-900">{erro}</p>}
    {!estado && !erro && <p role="status">Carregando itens da nota…</p>}
    {mensagem && <p role="status" className="mb-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950">{mensagem}</p>}
    {estado?.impedimento && <p className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">{estado.impedimento}{estado.erpUrl && <> <a className="underline" href={estado.erpUrl}>Abrir ERP</a></>}</p>}
    {estado && !estado.nota && <div className="mb-4 grid gap-3 text-sm">
      {estado.acompanhamento && <p className="font-semibold">{ROTULOS_RECEBIMENTO[estado.acompanhamento.estado]}</p>}
      {estado.acompanhamento?.manifestacao && <p>{estado.acompanhamento.manifestacao.protocolo ? `Protocolo • ${estado.acompanhamento.manifestacao.protocolo}` : "O resultado da manifestação será conferido pelos eventos recebidos da SEFAZ."}{estado.acompanhamento.manifestacao.motivo ? ` • ${estado.acompanhamento.manifestacao.motivo}` : ""}</p>}
      {estado.modo === "LOCAL" && !estado.acompanhamento?.cancelada && <>
        <p>Registrar ciência informa que você conhece a emissão. A conferência dos produtos será liberada quando o XML completo chegar.</p>
        <div className="flex flex-wrap gap-2">
          {estado.acompanhamento?.estado === "AGUARDANDO_MANIFESTACAO" && <button type="button" className="btn-secundario" disabled={Boolean(acao)} onClick={() => void atualizarDocumentos(true)}>{acao === "ciencia" ? "Enviando ciência…" : "Registrar ciência da emissão"}</button>}
          <button type="button" className="btn-secundario" disabled={Boolean(acao) || Boolean(estado.proximaConsultaEm && new Date(estado.proximaConsultaEm).getTime() > agora)} onClick={() => void atualizarDocumentos()}>{acao === "documentos" ? "Atualizando…" : "Atualizar documentos"}</button>
        </div>
        {estado.proximaConsultaEm && <p className="text-xs text-muted-foreground">Próxima consulta permitida • {new Date(estado.proximaConsultaEm).toLocaleString("pt-BR")}</p>}
      </>}
    </div>}
    {estado?.nota && <div className="mb-4 min-w-0 text-sm"><p className="font-semibold">NF-e {estado.nota.numero} · série {estado.nota.serie} · R$ {valor(estado.nota.total)}</p><p className="mt-1 break-words">{estado.nota.fornecedor.nome} · {estado.nota.fornecedor.documento}</p><p className="mt-1 break-all font-mono text-xs text-muted-foreground">{estado.nota.chave}</p></div>}
    {recibo ? <div className="grid gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950"><p role="status" className="font-semibold">Entrada registrada. Esta NF-e já movimentou o estoque.</p><p>Local: {recibo.local} · {new Date(recibo.confirmadoEm).toLocaleString("pt-BR")}</p><ul className="grid gap-2">{recibo.itens.map(item => <li key={item.numero}>Item {item.numero}: {item.descricaoFiscal} · {item.quantidade} unidade(s) · variante <span className="break-all font-mono text-xs">{item.varianteId}</span></li>)}</ul><p className="break-all text-xs">Recibo: {recibo.id}</p></div> : estado?.nota && !estado.impedimento && <form className="grid min-w-0 gap-4" onSubmit={e => { e.preventDefault(); void confirmar(); }}>
      <p className="text-sm text-muted-foreground">Vincule todos os itens a produtos já cadastrados. Confira as unidades físicas recebidas: caixas, quilos e quantidades fracionadas precisam ser convertidos por você para unidades inteiras de estoque.</p>
      <fieldset disabled={enviando} className="grid min-w-0 gap-4">
        {estado.nota.itens.map(item => {
          const linha = itens.find(i => i.numero === item.numero);
          return linha && <div key={item.numero} className="grid min-w-0 gap-3 rounded-xl border border-border p-3"><div className="min-w-0 text-sm"><h3 className="break-words font-semibold">{item.numero}. {item.descricao}</h3><p className="mt-1 break-words text-xs text-muted-foreground">Código: {item.codigo ?? "—"} · GTIN: {item.gtin ?? "—"} · NCM: {item.ncm ?? "—"} · CFOP: {item.cfop ?? "—"}</p><p className="mt-1">Na nota: {item.quantidade} {item.unidade} × R$ {valor(item.valorUnitario)} · total R$ {valor(item.valorTotal)}</p></div><BuscarVariante numero={item.numero} selecionada={linha.variante} selecionar={variante => mudar(item.numero, { variante })} /><label className="grid gap-1 text-sm">Unidades de estoque do item {item.numero}<input className={inputClasse} type="number" inputMode="numeric" min={1} max={10_000_000} step={1} required value={linha.quantidade} onChange={e => mudar(item.numero, { quantidade: e.target.value })} /></label></div>;
        })}
        <label className="grid gap-1 text-sm">Local de estoque<input className={inputClasse} list={locaisId} maxLength={80} required value={local} onChange={e => { setLocal(e.target.value); setConferido(false); }} /><span className="text-xs text-muted-foreground">Use um código como principal ou deposito-1. Um novo código cria um local de estoque.</span></label><datalist id={locaisId}>{locais.map(l => <option key={l} value={l} />)}</datalist>
        <label className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-4 shrink-0" checked={conferido} onChange={e => setConferido(e.target.checked)} />Conferi os produtos, quantidades e local de estoque</label>
        <p className="text-xs text-muted-foreground">A confirmação adiciona todas as linhas ao estoque. Não envia manifestação à SEFAZ nem registra contas a pagar. A mesma NF-e não pode gerar outra entrada.</p>
        <button className="btn-primario" disabled={!valido || !conferido || enviando}>{enviando ? "Registrando entrada…" : "Confirmar entrada no estoque"}</button>
      </fieldset>
    </form>}
  </dialog>;
}

function BuscarVariante({ numero, selecionada, selecionar }: { numero: number; selecionada: Variante | null; selecionar: (variante: Variante | null) => void }) {
  const [busca, setBusca] = useState(""), [resultados, setResultados] = useState<Variante[]>([]), [erro, setErro] = useState(""), [consultada, setConsultada] = useState("");
  useEffect(() => {
    if (selecionada || busca.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void fetch(`/api/painel/fiscal/entrada-estoque/variantes?q=${encodeURIComponent(busca.trim())}`, { signal: controller.signal }).then(async r => {
        const dados = await r.json();
        if (!r.ok) throw new Error(dados.erro ?? "Não foi possível buscar produtos.");
        setResultados(dados.itens); setConsultada(busca); setErro("");
      }).catch(e => { if (e.name !== "AbortError") setErro(e.message); });
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [busca, selecionada]);
  return <div className="grid min-w-0 gap-2"><label className="grid gap-1 text-sm">Buscar produto do item {numero}<input className={inputClasse} maxLength={80} autoComplete="off" placeholder="Nome, SKU ou GTIN" value={busca} onChange={e => { setBusca(e.target.value); selecionar(null); }} /></label>
    {selecionada ? <p className="break-words rounded-lg bg-emerald-50 p-2 text-sm text-emerald-950">Selecionado: {selecionada.nome} · {selecionada.variacao}{selecionada.sku ? ` · SKU ${selecionada.sku}` : ""}</p> : <>{erro && <p role="alert" className="text-sm text-red-900">{erro}</p>}{busca.length >= 2 && consultada === busca && <ul className="grid max-h-48 gap-2 overflow-y-auto">{resultados.map(v => <li key={v.id}><button type="button" className="w-full rounded-lg border border-border p-3 text-left text-sm hover:bg-muted" aria-label={`Selecionar ${v.nome} ${v.variacao}${v.sku ? ` SKU ${v.sku}` : ""}`} onClick={() => selecionar(v)}><strong className="block break-words">{v.nome}</strong><span className="block break-words text-xs text-muted-foreground">{v.variacao} · SKU {v.sku ?? "—"} · GTIN {v.gtin ?? "—"}</span></button></li>)}{!resultados.length && <li className="text-sm text-muted-foreground">Nenhum produto encontrado. Cadastre o produto em Produtos antes de dar entrada.</li>}</ul>}</>}
  </div>;
}
