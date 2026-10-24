"use client";

import { useEffect, useId, useState } from "react";
import { Download, ExternalLink, FileText, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { deduplicarDocumentosFiscais } from "@/lib/fiscal-lista";
import { separarDocumentosFiscais } from "@/lib/fiscal-monitor";
import { Secao, inputClasse } from "./campos";
import DownloadFiscal from "./DownloadFiscal";
import FluxosFiscais from "./FluxosFiscais";

type Estado = {
  configuracao: { cnpj: string; uf: string; titular: string; validoAte: string; proximaConsultaEm: string; ultimaMensagem: string | null } | null;
  documentos: Array<{
    id: string;
    completoId?: string | null;
    nsu: string;
    schema: string;
    chave: string | null;
    recebidoEm: string;
    tipo: "NFE" | "CTE" | "EVENTO" | "OUTRO";
    fornecedor: string | null;
    documentoFornecedor: string | null;
    inscricaoEstadual: string | null;
    numero: string | null;
    valorCentavos: number | null;
    emitidaEm: string | null;
    autorizadaEm: string | null;
    protocolo: string | null;
    operacao: string | null;
    situacaoNfe: string | null;
    manifestacao: string | null;
    manifestacaoEnvio: { status: string; codigo: string | null; motivo: string | null; protocolo: string | null } | null;
    quantidadeItens: number | null;
    eventoCodigo: string | null;
    eventoDescricao: string | null;
    eventoSequencia: number | null;
    eventoRegistradoEm: string | null;
    eventoStatus: string | null;
    eventoMotivo: string | null;
    situacao: "COMPLETA" | "RESUMO" | "EVENTO" | "OUTRO";
  }>;
  totais: { documentos: number; notas: number; ctes: number; eventos: number; outros: number; completas: number };
  ufEmpresa: string;
  pagina: number;
  paginas: number;
  total: number;
  erp: { notas: Array<{ id: number; chave: string; numero: number; serie: number; emitida_em: string; valor: number; fornecedor: { documento: string; nome: string; vinculado: boolean; id: number | null }; itens: number; compra_id: number | null }>; pendencias: Array<{ nsu: string; chave: string; emitida_em: string; valor: number; situacao: string; fornecedor: { documento: string; nome: string } }>; painelUrl: string } | { erro: string } | null;
  tms: { documentos: Array<{ id: string; chave: string; numero: number; serie: number; status: string; protocolo: string | null; emitido_em: string; cancelado_em: string | null; arquivos: { xml: string | null; dacte: string | null }; eventos: Array<{ id: string }> }>; painelUrl: string; slug: string } | { erro: string } | null;
};
const data = (valor: string) => {
  const lida = new Date(valor);
  return Number.isNaN(lida.getTime()) ? valor : lida.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
};
const dia = (valor: string) => {
  const lida = new Date(valor);
  return Number.isNaN(lida.getTime()) ? valor : lida.toLocaleDateString("pt-BR");
};
const cnpjFormatado = (cnpj: string) => cnpj.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, "$1.$2.$3/$4-$5");
const documentoFormatado = (documento: string | null) => {
  if (!documento) return null;
  if (/^\d{14}$/.test(documento)) return cnpjFormatado(documento);
  if (/^\d{11}$/.test(documento)) return documento.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return documento;
};
const dinheiro = (centavos: number | null) => centavos == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);
const serieDaChave = (chave: string | null) => chave && /^\d{44}$/.test(chave) ? String(Number(chave.slice(22, 25))) : "—";
type ColunaOrdenacao = "emissao" | "numero" | "serie" | "tipo" | "documento" | "ie" | "nome" | "valor" | "situacao";

function tipoDocumento(schema: string) {
  if (schema.startsWith("resNFe")) return "Resumo de NF-e";
  if (schema.startsWith("procNFe")) return "NF-e completa";
  if (schema.startsWith("resCTe")) return "Resumo de CT-e";
  if (/^(procCTe|cteProc)/i.test(schema)) return "CT-e completo";
  if (/evento/i.test(schema)) return "Evento da NF-e";
  return "Documento fiscal";
}

function nomeEvento(doc: Estado["documentos"][number]) {
  return doc.eventoDescricao ?? (doc.eventoCodigo ? `Evento ${doc.eventoCodigo}` : tipoDocumento(doc.schema));
}

function textoSituacao(doc: Estado["documentos"][number], manifestacao?: string | null) {
  if (doc.situacao === "COMPLETA") return doc.situacaoNfe ?? "XML completo";
  if (doc.manifestacaoEnvio?.status === "ACEITA") return `Manifestação aceita${doc.manifestacaoEnvio.protocolo ? ` · protocolo ${doc.manifestacaoEnvio.protocolo}` : ""}`;
  if (doc.manifestacaoEnvio?.status === "REJEITADA") return `Manifestação rejeitada${doc.manifestacaoEnvio.codigo ? ` (${doc.manifestacaoEnvio.codigo})` : ""}: ${doc.manifestacaoEnvio.motivo ?? "consulte a auditoria"}`;
  if (doc.manifestacaoEnvio) return `Manifestação ${doc.manifestacaoEnvio.status.toLowerCase().replaceAll("_", " ")}`;
  if (doc.situacao === "RESUMO") return manifestacao ?? "Sem manifestação informada";
  return doc.situacaoNfe ?? "Documento recebido";
}

export default function Fiscal() {
  const arquivoId = useId();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [arquivoNome, setArquivoNome] = useState("");
  const [agora] = useState(() => Date.now());
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState("nfe-recebidas");
  const [somenteDisponiveis, setSomenteDisponiveis] = useState(false);
  const [pagina, setPagina] = useState(1);
  const [inicio, setInicio] = useState("");
  const [fim, setFim] = useState("");
  const [documentoSelecionado, setDocumentoSelecionado] = useState<Estado["documentos"][number] | null>(null);
  const [ordenacao, setOrdenacao] = useState<{ coluna: ColunaOrdenacao; direcao: "asc" | "desc" }>({ coluna: "emissao", direcao: "desc" });

  useEffect(() => {
    const controller = new AbortController();
    const parametros = new URLSearchParams({ busca, tipo, pagina: String(pagina), inicio, fim, arquivos: somenteDisponiveis ? "disponiveis" : "todos" });
    const timer = setTimeout(() => { void fetch(`/api/painel/fiscal?${parametros}`, { signal: controller.signal }).then(async (r) => {
      const dados = await r.json();
      if (!r.ok) throw new Error(dados.erro);
      setEstado(dados);
    }).catch((e) => { if (e.name !== "AbortError") setErro(e.message); }); }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [busca, tipo, somenteDisponiveis, pagina, inicio, fim]);

  async function enviar(form?: HTMLFormElement) {
    setOcupado(form ? "certificado" : "consulta");
    setErro("");
    setMensagem("");
    try {
      const r = await fetch(`/api/painel/fiscal${form ? "" : "?acao=consultar"}`, {
        method: "POST",
        ...(form ? { body: new FormData(form) } : {}),
      });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados.erro ?? "Não foi possível concluir a operação.");
      setEstado(dados);
      setBusca(""); setTipo("nfe-recebidas"); setSomenteDisponiveis(false); setPagina(1); setInicio(""); setFim("");
      setMensagem(form ? "Certificado guardado com segurança." : `${dados.resultado.recebidos} documento(s) recebido(s). ${dados.resultado.mensagem}`);
      if (form) {
        form.reset();
        setArquivoNome("");
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao acessar o serviço.");
    } finally {
      setOcupado(null);
    }
  }

  async function manifestar(doc: Estado["documentos"][number], tipo: "CIENCIA" | "CONFIRMACAO" | "DESCONHECIMENTO" | "NAO_REALIZADA") {
    const efeitos = {
      CIENCIA: "registra que você tomou conhecimento da emissão; não confirma a compra.",
      CONFIRMACAO: "confirma que a operação ocorreu e produz efeito fiscal.",
      DESCONHECIMENTO: "declara que você não reconhece esta operação.",
      NAO_REALIZADA: "declara que a operação conhecida não foi realizada.",
    } as const;
    let justificativa: string | undefined;
    if (tipo === "NAO_REALIZADA") {
      justificativa = window.prompt("Informe a justificativa fiscal (15 a 255 caracteres):")?.trim();
      if (!justificativa) return;
    }
    if (!window.confirm(`Confirma o envio real à SEFAZ? Esta ação ${efeitos[tipo]}`)) return;
    setOcupado(`manifestacao:${doc.id}`); setErro(""); setMensagem("");
    try {
      const resposta = await fetch(`/api/painel/fiscal/documentos/${doc.id}/manifestacao`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ tipo, justificativa, confirmacao: true }) });
      const resultado = await resposta.json();
      if (!resposta.ok) throw new Error(resultado.erro ?? "A SEFAZ não confirmou a manifestação.");
      setMensagem(resultado.aceita ? `Manifestação aceita pela SEFAZ. Protocolo ${resultado.protocolo}. A busca do XML completo foi executada.` : `Manifestação não aceita: ${resultado.codigo} — ${resultado.motivo}`);
      setPagina(1);
      const atualizada = await fetch(`/api/painel/fiscal?tipo=${tipo === "CIENCIA" ? "nfe-recebidas" : tipo}`).then((r) => r.json());
      setEstado(atualizada);
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao manifestar."); }
    finally { setOcupado(null); }
  }

  const configuracao = estado?.configuracao;
  const documentosSeparados = separarDocumentosFiscais(estado?.documentos ?? []);
  const valorOrdenacao = (doc: Estado["documentos"][number], coluna: ColunaOrdenacao): string | number => ({
    emissao: doc.emitidaEm ? new Date(doc.emitidaEm).getTime() : 0,
    numero: Number(doc.numero) || 0,
    serie: Number(serieDaChave(doc.chave)) || 0,
    tipo: doc.operacao ?? "",
    documento: doc.documentoFornecedor ?? "",
    ie: doc.inscricaoEstadual ?? "",
    nome: doc.fornecedor ?? "",
    valor: doc.valorCentavos ?? 0,
    situacao: textoSituacao(doc, doc.manifestacao),
  })[coluna];
  const notasUnicas = deduplicarDocumentosFiscais(documentosSeparados.notas);
  const notasOrdenadas = [...notasUnicas].sort((a, b) => {
    const av = valorOrdenacao(a, ordenacao.coluna); const bv = valorOrdenacao(b, ordenacao.coluna);
    const resultado = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv), "pt-BR", { numeric: true });
    return ordenacao.direcao === "asc" ? resultado : -resultado;
  });
  const ordenar = (coluna: ColunaOrdenacao) => setOrdenacao((atual) => ({ coluna, direcao: atual.coluna === coluna && atual.direcao === "asc" ? "desc" : "asc" }));
  const manifestacoesPorChave = new Map<string, string>();
  for (const evento of documentosSeparados.eventos) {
    if (evento.chave && evento.eventoCodigo?.startsWith("2102") && !manifestacoesPorChave.has(evento.chave)) {
      manifestacoesPorChave.set(evento.chave, nomeEvento(evento));
    }
  }
  const erpPorChave = new Map(estado?.erp && "notas" in estado.erp ? estado.erp.notas.map((nota) => [nota.chave, nota.id] as const) : []);
  const vencido = configuracao ? new Date(configuracao.validoAte).getTime() <= agora : false;
  const formulario = (
    <form className="grid min-w-0 gap-4" onSubmit={(e) => { e.preventDefault(); void enviar(e.currentTarget); }}>
      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-relaxed text-blue-950">
        <p className="font-semibold">Não instale o certificado no Windows.</p>
        <p className="mt-1">Use o arquivo .pfx ou .p12 diretamente aqui. Você só precisa escolher o arquivo e informar a senha.</p>
      </div>
      <div className="min-w-0">
        <label htmlFor={arquivoId} className="mb-2 block text-sm font-medium">1. Escolha o arquivo do certificado</label>
        <label className="relative flex min-h-24 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 focus-within:ring-2 focus-within:ring-foreground">
          <Upload size={22} aria-hidden="true" className="shrink-0 text-muted-foreground" />
          <span className="min-w-0">
            <span className="block break-all text-sm font-semibold">{arquivoNome || "Selecionar certificado"}</span>
            <span className="mt-1 block text-xs text-muted-foreground">Arquivo A1 .pfx ou .p12 · até 64 KB</span>
          </span>
          <input id={arquivoId} aria-label="Arquivo do certificado" name="certificado" type="file" accept=".pfx,.p12" required disabled={!!ocupado} className="sr-only" onChange={(e) => setArquivoNome(e.target.files?.[0]?.name ?? "")} />
        </label>
      </div>
      <label className="grid gap-2 text-sm font-medium">
        2. Digite a senha do certificado
        <input name="senha" type="password" autoComplete="off" maxLength={1024} className={inputClasse} disabled={!!ocupado} />
      </label>
      <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-sm">
        <span className="text-muted-foreground">UF da empresa</span>
        <strong className="ml-2">{estado?.ufEmpresa || "Não cadastrada"}</strong>
        {!estado?.ufEmpresa && <p className="mt-1 text-xs text-amber-900">Preencha a UF em Dados da empresa antes de guardar o certificado.</p>}
      </div>
      <button disabled={!!ocupado || !estado?.ufEmpresa} className="btn-primario w-full sm:w-fit">
        <ShieldCheck size={17} aria-hidden="true" />
        {ocupado === "certificado" ? "Conectando certificado…" : "Conectar certificado"}
      </button>
      <p className="text-xs leading-relaxed text-muted-foreground">O nome do arquivo não importa. O CNPJ e a UF são conferidos automaticamente com os Dados da empresa. O arquivo e a senha ficam criptografados.</p>
    </form>
  );

  return (
    <div className="grid min-w-0 gap-5">
      {erro && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">{erro}</p>}
      {mensagem && <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">{mensagem}</p>}
      <Secao titulo="Certificado digital A1" descricao={configuracao ? "Identificação da empresa e validade do certificado." : "Conecte o certificado da empresa para começar a receber NF-e."}>
        {!estado ? <p role="status" className="text-sm text-muted-foreground">Carregando configuração fiscal…</p> : (
          <>
            {configuracao && (
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center">
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${vencido ? "bg-amber-100 text-amber-900" : "bg-emerald-50 text-emerald-800"}`}>
                  {vencido ? "Certificado vencido" : "Certificado válido"}
                </span>
                <p className="min-w-0 flex-1 break-words text-sm font-semibold">{configuracao.titular.replace(new RegExp(`:${configuracao.cnpj}$`), "")}</p>
                <dl className="flex flex-wrap gap-x-6 gap-y-2 text-sm sm:justify-end">
                  <div><dt className="text-xs text-muted-foreground">CNPJ</dt><dd className="mt-0.5 font-mono tabular-nums">{cnpjFormatado(configuracao.cnpj)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Validade</dt><dd className="mt-0.5 tabular-nums">{dia(configuracao.validoAte)}</dd></div>
                </dl>
                {vencido && <p className="text-sm text-amber-900">Envie um certificado válido para retomar as consultas.</p>}
              </div>
            )}
            {configuracao ? (
              <details className="min-w-0 border-t border-border pt-4" open={vencido || undefined}>
                <summary className="cursor-pointer text-sm font-medium">Substituir certificado</summary>
                <div className="mt-4">{formulario}</div>
              </details>
            ) : formulario}
          </>
        )}
      </Secao>

      <Secao titulo="Monitor fiscal do CNPJ" descricao="Notas fiscais organizadas por categoria. Sincronização automática pela SEFAZ.">
        {configuracao && !(estado?.erp && "notas" in estado.erp) && (
          <div className="grid gap-3 border-b border-border pb-4">
            <div className="flex items-start gap-2 text-sm">
              <RefreshCw size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-muted-foreground" />
              <div>
                <p className="font-medium">{vencido ? "Busca pausada: certificado vencido" : "Busca automática ativada"}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Próxima consulta a partir de {data(configuracao.proximaConsultaEm)}.</p>
              </div>
            </div>
            {configuracao.ultimaMensagem && <p className="break-words text-sm text-muted-foreground">{configuracao.ultimaMensagem}</p>}
            <button onClick={() => void enviar()} disabled={!!ocupado || vencido} className="btn-secundario w-full sm:w-fit">
              <RefreshCw size={16} aria-hidden="true" className={ocupado === "consulta" ? "animate-spin motion-reduce:animate-none" : ""} />
              {ocupado === "consulta" ? "Consultando…" : "Sincronizar CNPJ"}
            </button>
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-1 text-xs">Buscar fornecedor, nota, chave ou NSU<input className={inputClasse} maxLength={100} value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} /></label>
          <label className="grid gap-1 text-xs">Categoria<select className={inputClasse} value={tipo} onChange={(e) => { setTipo(e.target.value); setPagina(1); }}><optgroup label="NF-e"><option value="nfe-recebidas">Recebidas pela distribuição nacional</option><option value="nfe-enviadas" disabled>Emitidas — exige fonte oficial do emitente</option><option value="nfe-citadas" disabled>Citadas/autorizadas — fonte não configurada</option></optgroup><optgroup label="CT-e"><option value="cte" disabled={!estado?.tms || "erro" in estado.tms}>{estado?.tms && !("erro" in estado.tms) ? "Gerenciados pelo TMS" : "Indisponível — TMS não configurado"}</option></optgroup></select></label>
          <label className="grid gap-1 text-xs">Recebido de<input className={inputClasse} type="date" value={inicio} onChange={(e) => { setInicio(e.target.value); setPagina(1); }} /></label>
          <label className="grid gap-1 text-xs">Recebido até<input className={inputClasse} type="date" value={fim} onChange={(e) => { setFim(e.target.value); setPagina(1); }} /></label>
        </div>
        <p className="-mt-1 text-xs leading-relaxed text-muted-foreground">NF-e é consultada pelo ERP; CT-e autorizado é lido do TMS. O Lojas não disputa cursor nem transmite documento fiscal.</p>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Disponibilidade dos documentos">
          <button type="button" className={`btn-secundario ${!somenteDisponiveis ? "border-primary text-primary" : ""}`} aria-pressed={!somenteDisponiveis} onClick={() => { setSomenteDisponiveis(false); setPagina(1); }}>Todas as NF-e</button>
          <button type="button" className={`btn-secundario ${somenteDisponiveis ? "border-primary text-primary" : ""}`} aria-pressed={somenteDisponiveis} onClick={() => { setSomenteDisponiveis(true); setPagina(1); }}>Com XML e PDF ({estado?.totais.completas ?? 0})</button>
          {(busca || inicio || fim || somenteDisponiveis || tipo !== "nfe-recebidas") && <button type="button" className="min-h-11 px-2 text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline" onClick={() => { setBusca(""); setTipo("nfe-recebidas"); setSomenteDisponiveis(false); setInicio(""); setFim(""); setPagina(1); }}>Limpar filtros</button>}
        </div>
        {estado?.erp && "erro" in estado.erp && <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Integração com o ERP: {estado.erp.erro}</p>}
        {estado?.erp && "notas" in estado.erp && (
          <div className="mb-5 grid min-w-0 gap-3 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Conferência operacional no ERP</h3><p className="mt-1 text-xs text-muted-foreground">XML completo, DANFE, fornecedor, produtos, compra, custos e estoque ficam em uma única escrituração.</p></div><a className="btn-secundario" href={estado.erp.painelUrl}><ExternalLink size={15} aria-hidden="true" /> Gerenciar no ERP</a></div>
            <p className="text-xs text-muted-foreground">A consulta à SEFAZ deste CNPJ é feita somente pelo ERP para preservar a sequência NSU.</p>
            {estado.erp.pendencias.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3"><p className="text-sm font-medium text-amber-950">{estado.erp.pendencias.length} NF-e aguardando XML completo</p><ul className="mt-2 divide-y divide-amber-200">{estado.erp.pendencias.map((item) => <li key={item.nsu} className="flex items-start justify-between gap-3 py-2 text-sm"><span className="min-w-0"><strong className="block truncate">{item.fornecedor.nome}</strong><span className="text-xs text-amber-900">Resumo NSU {item.nsu} · {data(item.emitida_em)}</span></span><strong className="shrink-0">{dinheiro(Math.round(item.valor * 100))}</strong></li>)}</ul><p className="mt-2 text-xs text-amber-900">Use “Gerenciar no ERP” para manifestar ciência e solicitar o XML completo. Resumo não é disponibilizado como nota completa.</p></div>}
            {!estado.erp.notas.length ? <p className="text-sm text-muted-foreground">O ERP ainda não registrou NF-e completa para esta empresa.</p> : <ul className="divide-y divide-border">{estado.erp.notas.map((nota) => <li key={nota.id} className="grid gap-2 py-3 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"><div className="min-w-0"><div className="flex items-start justify-between gap-3"><p className="font-semibold">{nota.fornecedor.nome}</p><strong className="shrink-0 text-sm">{dinheiro(Math.round(nota.valor * 100))}</strong></div><p className="mt-1 text-xs text-muted-foreground">NF-e {nota.numero} · série {nota.serie} · {nota.itens} item(ns) · {data(nota.emitida_em)}</p><p className="mt-1 text-xs text-muted-foreground">{nota.fornecedor.vinculado ? "Fornecedor vinculado" : "Fornecedor pendente"} · {nota.compra_id ? `Compra #${nota.compra_id} criada` : "Compra e custos pendentes"}</p></div><div className="flex flex-wrap gap-2"><DownloadFiscal className="btn-secundario" href={`/api/painel/fiscal/erp/documentos/${nota.id}/xml`} fallback={`NFe-${nota.id}.xml`}><Download size={15} aria-hidden="true" /> XML</DownloadFiscal><DownloadFiscal className="btn-secundario" href={`/api/painel/fiscal/erp/documentos/${nota.id}/danfe`} fallback={`DANFE-${nota.id}.pdf`}><FileText size={15} aria-hidden="true" /> PDF</DownloadFiscal></div></li>)}</ul>}
          </div>
        )}
        {estado?.tms && "erro" in estado.tms && <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Integração com o TMS: {estado.tms.erro}</p>}
        {estado?.tms && "documentos" in estado.tms && (
          <div className="mb-5 grid min-w-0 gap-3 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">CT-e gerenciados pelo TMS</h3><p className="mt-1 text-xs text-muted-foreground">Emissão, eventos, XML e DACTE permanecem no módulo fiscal isolado do TMS.</p></div><a className="btn-secundario" href={estado.tms.painelUrl}><ExternalLink size={15} aria-hidden="true" /> Gerenciar no TMS</a></div>
            {!estado.tms.documentos.length ? <p className="text-sm text-muted-foreground">O TMS ainda não registrou CT-e para esta empresa.</p> : <ul className="divide-y divide-border">{estado.tms.documentos.map((cte) => <li key={cte.id} className="grid gap-2 py-3 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"><div className="min-w-0"><p className="font-semibold">CT-e {cte.numero} · série {cte.serie}</p><p className="mt-1 break-all text-xs text-muted-foreground">{cte.chave}</p><p className="mt-1 text-xs text-muted-foreground">{cte.status} · {cte.protocolo ? `protocolo ${cte.protocolo}` : "sem protocolo autorizado"} · {data(cte.emitido_em)}</p></div><div className="flex flex-wrap gap-2">{cte.arquivos.xml && <a className="btn-secundario" href={`/api/painel/fiscal/tms/documentos/${cte.id}/xml`} download><Download size={15} aria-hidden="true" /> XML</a>}{cte.arquivos.dacte && <a className="btn-secundario" href={`/api/painel/fiscal/tms/documentos/${cte.id}/dacte`} download><FileText size={15} aria-hidden="true" /> DACTE</a>}</div></li>)}</ul>}
          </div>
        )}
        {!estado ? <p role="status" className="text-sm text-muted-foreground">Carregando documentos…</p> : !estado.documentos.length ? (
          <div className="py-4 text-center">
            <FileText size={28} aria-hidden="true" className="mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Nenhum documento encontrado.</p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{configuracao ? "Consulte o próximo lote para buscar documentos disponíveis." : "Guarde o certificado acima para iniciar a busca."}</p>
          </div>
        ) : (
          <div className="grid min-w-0 gap-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">NF-e no histórico</p>
                <p className="mt-1 text-2xl font-semibold">{estado.totais.notas}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">CT-e no histórico</p>
                <p className="mt-1 text-2xl font-semibold">{estado.totais.ctes}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Eventos fiscais</p>
                <p className="mt-1 text-2xl font-semibold">{estado.totais.eventos}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Documentos no histórico</p>
                <p className="mt-1 text-2xl font-semibold">{estado.totais.documentos}</p>
              </div>
            </div>
            {!!documentosSeparados.ctes.length && (
              <div className="min-w-0">
                <h3 className="mb-1 text-sm font-semibold">Conhecimentos de transporte</h3>
                <p className="mb-3 text-xs text-muted-foreground">CT-e recebidos de fonte oficial identificada. A tela não consulta CT-e pelo serviço exclusivo de NF-e.</p>
                <ul className="divide-y divide-border rounded-xl border border-border px-3">
                  {documentosSeparados.ctes.map((doc) => <DocumentoFiscal key={doc.id} doc={doc} selecionar={setDocumentoSelecionado} />)}
                </ul>
              </div>
            )}
            <div className="min-w-0">
              <h3 className="mb-1 text-sm font-semibold">Notas fiscais</h3>
              <p className="mb-2 text-xs text-muted-foreground">{estado.totais.completas} XML(s) completo(s) já disponíveis para download. Notas ainda sem XML completo dependem da disponibilização pela SEFAZ e, quando cabível, da manifestação fiscal autorizada do destinatário.</p>
              <p className="mb-3 text-xs text-muted-foreground">{notasOrdenadas.length} nota(s) única(s) nesta página. XML e PDF ficam disponíveis quando recebidos integralmente.</p>
              {!documentosSeparados.notas.length ? <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Nenhuma NF-e encontrada neste lote.</p> : (
                <>
                  <ul className="divide-y divide-border sm:hidden">
                    {notasOrdenadas.map((doc) => <DocumentoFiscal key={doc.id} doc={doc} selecionar={setDocumentoSelecionado} manifestar={manifestar} ocupado={ocupado === `manifestacao:${doc.id}`} erpId={doc.chave ? erpPorChave.get(doc.chave) : undefined} manifestacao={doc.manifestacao ?? (doc.chave ? manifestacoesPorChave.get(doc.chave) : null)} />)}
                  </ul>
                  <div className="hidden overflow-x-auto rounded-xl border border-border sm:block">
                    <table className="w-full min-w-[816px] table-fixed text-left text-xs">
                      <thead className="sticky top-0 z-10 bg-muted text-muted-foreground"><tr><th className="w-24 whitespace-nowrap px-2 py-1.5">Arquivos</th>{([['emissao','Emissão','w-20'],['numero','Número','w-16'],['serie','Série','w-12'],['tipo','Tipo','hidden w-16 2xl:table-cell'],['documento','CNPJ/CPF','w-28'],['ie','IE','hidden w-28 2xl:table-cell'],['nome','Nome','w-36'],['valor','Valor','w-20 text-right'],['situacao','Situação','w-28']] as Array<[ColunaOrdenacao,string,string]>).map(([coluna, rotulo, classe]) => <th key={coluna} className={`px-2 py-1.5 ${classe}`}><button type="button" className="min-h-8 whitespace-nowrap font-semibold hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2" onClick={() => ordenar(coluna)}>{rotulo}{ordenacao.coluna === coluna ? (ordenacao.direcao === 'asc' ? ' ↑' : ' ↓') : ''}</button></th>)}<th className="w-20 px-2 py-1.5 text-right">Ações</th></tr></thead>
                      <tbody className="divide-y divide-border">{notasOrdenadas.map((doc) => <LinhaDocumentoFiscal key={doc.id} doc={doc} manifestar={manifestar} ocupado={ocupado === `manifestacao:${doc.id}`} erpId={doc.chave ? erpPorChave.get(doc.chave) : undefined} manifestacao={doc.manifestacao ?? (doc.chave ? manifestacoesPorChave.get(doc.chave) : null)} />)}</tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <details className="min-w-0 border-t border-border pt-4">
              <summary className="cursor-pointer mb-1 text-sm font-semibold">Histórico técnico de eventos fiscais</summary>
              <p className="mb-3 text-xs text-muted-foreground">Eventos desta página, com tipo, NF-e e protocolo. Use o filtro de tipo para consultar somente eventos.</p>
              {!documentosSeparados.eventos.length ? <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Nenhum evento fiscal recebido.</p> : (
                <>
                  <ul className="divide-y divide-border sm:hidden">
                    {documentosSeparados.eventos.map((doc) => <EventoFiscal key={doc.id} doc={doc} />)}
                  </ul>
                  <div className="hidden overflow-x-auto rounded-xl border border-border sm:block">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-3">Registrado</th><th className="px-3 py-3">Evento</th><th className="px-3 py-3">NF-e</th><th className="px-3 py-3">Protocolo</th><th className="px-3 py-3" /></tr></thead>
                      <tbody className="divide-y divide-border">{documentosSeparados.eventos.map((doc) => <LinhaEventoFiscal key={doc.id} doc={doc} />)}</tbody>
                    </table>
                  </div>
                </>
              )}
            </details>
            {!!documentosSeparados.outros.length && (
              <details className="min-w-0 border-t border-border pt-4">
                <summary className="cursor-pointer text-sm font-medium">Outros documentos ({estado.totais.outros})</summary>
                <ul className="mt-3 divide-y divide-border">
                  {documentosSeparados.outros.map((doc) => <DocumentoFiscal key={doc.id} doc={doc} selecionar={setDocumentoSelecionado} />)}
                </ul>
              </details>
            )}
            <p className="text-xs text-muted-foreground">{estado.total} documento(s) encontrados · Página {estado.pagina} de {estado.paginas}. Os indicadores acima contam todo o histórico salvo.</p>
          </div>
        )}
        {estado && estado.paginas > 1 && <div className="flex gap-2"><button className="btn-secundario" disabled={pagina <= 1} onClick={() => setPagina((p) => p - 1)}>Anterior</button><button className="btn-secundario" disabled={pagina >= estado.paginas} onClick={() => setPagina((p) => p + 1)}>Próxima</button></div>}
        <details className="border-t border-border pt-4 text-sm">
          <summary className="cursor-pointer font-medium">Sobre esta consulta</summary>
          <div className="mt-3 grid gap-3 text-sm leading-relaxed text-muted-foreground">
            <p>A SEFAZ limita o período e os documentos disponíveis. Esta consulta não recupera todo o histórico do CNPJ e não inclui NFS-e ou NFC-e.</p>
            <p>A identificação da NF-e pode anteceder a entrega do XML completo pela SEFAZ. O sistema não disponibiliza arquivo parcial para download.</p>
            <p>A manifestação do destinatário é uma declaração fiscal. Esta tela identifica as manifestações já recebidas, mas não envia nenhuma decisão automaticamente.</p>
            <p>Se outro programa consulta este CNPJ, coordene o uso com o suporte antes de ativar para evitar bloqueios da SEFAZ.</p>
          </div>
        </details>
      </Secao>
      <FluxosFiscais documento={documentoSelecionado} />
    </div>
  );
}

type Manifestar = (doc: Estado["documentos"][number], tipo: "CIENCIA" | "CONFIRMACAO" | "DESCONHECIMENTO" | "NAO_REALIZADA") => Promise<void>;

function AcoesManifestacao({ doc, manifestar, ocupado = false, compacto = false }: { doc: Estado["documentos"][number]; manifestar?: Manifestar; ocupado?: boolean; compacto?: boolean }) {
  if (!manifestar || doc.situacao !== "RESUMO" || doc.tipo !== "NFE") return null;
  return <details className="relative"><summary className={compacto ? "inline-flex h-8 cursor-pointer list-none items-center rounded-md border border-border px-2 font-medium" : "btn-secundario min-h-11 cursor-pointer list-none"}>{ocupado ? "Enviando…" : "Manifestar"}</summary><div className="z-10 mt-2 grid min-w-64 gap-2 rounded-xl border border-border bg-background p-3 shadow-lg sm:absolute sm:left-0"><button disabled={ocupado} className="btn-secundario justify-start" onClick={() => void manifestar(doc, "CIENCIA")}>Ciência da Emissão</button><button disabled={ocupado} className="btn-secundario justify-start" onClick={() => void manifestar(doc, "CONFIRMACAO")}>Confirmação da Operação</button><button disabled={ocupado} className="btn-secundario justify-start" onClick={() => void manifestar(doc, "DESCONHECIMENTO")}>Desconhecimento</button><button disabled={ocupado} className="btn-secundario justify-start" onClick={() => void manifestar(doc, "NAO_REALIZADA")}>Operação não Realizada</button></div></details>;
}

function DocumentoFiscal({ doc, manifestacao, selecionar, erpId, manifestar, ocupado }: { doc: Estado["documentos"][number]; manifestacao?: string | null; erpId?: number; selecionar: (doc: Estado["documentos"][number]) => void; manifestar?: Manifestar; ocupado?: boolean }) {
  const rotuloXml = "XML";
  const cte = doc.tipo === "CTE";
  return (
    <li className="grid min-w-0 gap-3 py-4 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3"><p className="min-w-0 text-sm font-semibold">{doc.fornecedor ?? tipoDocumento(doc.schema)}</p><strong className="shrink-0 text-sm">{dinheiro(doc.valorCentavos)}</strong></div>
        <p className="mt-1 text-xs text-muted-foreground">{doc.numero ? `Nota ${doc.numero} · ` : ""}Recebida em {data(doc.recebidoEm)}</p>
        <p className={`mt-2 text-xs ${doc.situacao === "RESUMO" ? "text-amber-900" : "text-muted-foreground"}`}>{textoSituacao(doc, manifestacao)}</p>
      </div>
      <div className="flex flex-wrap gap-2"><AcoesManifestacao doc={doc} manifestar={manifestar} ocupado={ocupado} />{!cte && <a className="btn-secundario" href="#fluxos-fiscais" onClick={() => selecionar(doc)}>Usar no fluxo</a>}{(erpId || doc.situacao === "COMPLETA") && <DownloadFiscal className="btn-secundario w-full sm:w-auto" href={erpId ? `/api/painel/fiscal/erp/documentos/${erpId}/xml` : `/api/painel/fiscal/documentos/${doc.completoId ?? doc.id}`} fallback={`NFe-${erpId ?? doc.completoId ?? doc.id}.xml`}>
        <Download size={16} aria-hidden="true" /> {rotuloXml}
      </DownloadFiscal>}{!cte && (erpId || doc.situacao === "COMPLETA") ? <DownloadFiscal className="btn-secundario" href={erpId ? `/api/painel/fiscal/erp/documentos/${erpId}/danfe` : `/api/painel/fiscal/documentos/${doc.completoId ?? doc.id}/danfe`} fallback={`DANFE-${erpId ?? doc.completoId ?? doc.id}.pdf`}><FileText size={16} aria-hidden="true" /> DANFE PDF</DownloadFiscal> : <span className="self-center text-xs text-muted-foreground">{cte && doc.situacao === "COMPLETA" ? "DACTE indisponível: renderizador não configurado" : "XML e PDF pendentes"}</span>}</div>
    </li>
  );
}

function LinhaDocumentoFiscal({ doc, manifestacao, erpId, manifestar, ocupado }: { doc: Estado["documentos"][number]; manifestacao?: string | null; erpId?: number; manifestar: Manifestar; ocupado: boolean }) {
  const arquivosDisponiveis = Boolean(erpId || doc.situacao === "COMPLETA");
  const idDocumento = doc.completoId ?? doc.id;
  const classeDownload = "inline-flex h-8 items-center gap-1 rounded-md border border-border px-2 font-medium";
  return (
    <tr className="whitespace-nowrap even:bg-muted/20 hover:bg-muted/40">
      <td className="px-2 py-1.5"><div className="flex items-center gap-1">{arquivosDisponiveis ? <><DownloadFiscal className={classeDownload} href={erpId ? `/api/painel/fiscal/erp/documentos/${erpId}/xml` : `/api/painel/fiscal/documentos/${idDocumento}`} fallback={`NFe-${erpId ?? idDocumento}.xml`} title="Baixar XML completo"><Download size={13} aria-hidden="true" /> XML</DownloadFiscal><DownloadFiscal className={classeDownload} href={erpId ? `/api/painel/fiscal/erp/documentos/${erpId}/danfe` : `/api/painel/fiscal/documentos/${idDocumento}/danfe`} fallback={`DANFE-${erpId ?? idDocumento}.pdf`} title="Baixar DANFE em PDF"><FileText size={13} aria-hidden="true" /> PDF</DownloadFiscal></> : <><span className={`${classeDownload} cursor-not-allowed text-muted-foreground opacity-60`} aria-disabled="true" title="XML completo ainda não disponível"><Download size={13} aria-hidden="true" /> XML</span><span className={`${classeDownload} cursor-not-allowed text-muted-foreground opacity-60`} aria-disabled="true" title="PDF disponível somente após o XML completo"><FileText size={13} aria-hidden="true" /> PDF</span></>}</div></td>
      <td className="whitespace-nowrap px-2 py-2">{doc.emitidaEm ? dia(doc.emitidaEm) : dia(doc.recebidoEm)}</td>
      <td className="px-2 py-2 font-medium">{doc.numero ?? "—"}</td>
      <td className="px-2 py-2">{serieDaChave(doc.chave)}</td>
      <td className="hidden px-2 py-2 2xl:table-cell">{doc.operacao ?? "—"}</td>
      <td className="whitespace-nowrap px-2 py-2 font-mono text-[11px]">{documentoFormatado(doc.documentoFornecedor) ?? "—"}</td>
      <td className="hidden px-2 py-2 font-mono text-[11px] 2xl:table-cell">{doc.inscricaoEstadual ?? "—"}</td>
      <td className="max-w-56 px-2 py-2"><span className="block truncate" title={doc.fornecedor ?? undefined}>{doc.fornecedor ?? "Não informado"}</span></td>
      <td className="whitespace-nowrap px-2 py-2 text-right font-medium tabular-nums">{dinheiro(doc.valorCentavos)}</td>
      <td className="max-w-36 px-2 py-2"><span className={`block truncate rounded-full px-2 py-1 text-center font-medium ${doc.situacao === "COMPLETA" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`} title={textoSituacao(doc, manifestacao)}>{textoSituacao(doc, manifestacao)}</span></td>
      <td className="px-2 py-1.5 text-right"><div className="flex justify-end"><AcoesManifestacao doc={doc} manifestar={manifestar} ocupado={ocupado} compacto /></div></td>
    </tr>
  );
}

function EventoFiscal({ doc }: { doc: Estado["documentos"][number] }) {
  return (
    <li className="grid min-w-0 gap-3 py-4 first:pt-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{nomeEvento(doc)}</p>
        <p className="mt-1 text-xs text-muted-foreground">{doc.numero ? `NF-e ${doc.numero} · ` : ""}{data(doc.eventoRegistradoEm ?? doc.recebidoEm)}</p>
        <details className="mt-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer py-1">Ver dados do evento</summary>
          <dl className="mt-2 grid gap-2">
            {doc.eventoCodigo && <div><dt>Código do evento</dt><dd className="text-foreground">{doc.eventoCodigo}</dd></div>}
            {doc.eventoSequencia != null && <div><dt>Sequência</dt><dd className="text-foreground">{doc.eventoSequencia}</dd></div>}
            {doc.protocolo && <div><dt>Protocolo</dt><dd className="break-all text-foreground">{doc.protocolo}</dd></div>}
            {doc.eventoStatus && <div><dt>Status SEFAZ</dt><dd className="text-foreground">{doc.eventoStatus}</dd></div>}
            {doc.eventoMotivo && <div><dt>Resposta SEFAZ</dt><dd className="text-foreground">{doc.eventoMotivo}</dd></div>}
            {doc.chave && <div><dt>Chave de acesso</dt><dd className="break-all text-foreground">{doc.chave}</dd></div>}
          </dl>
        </details>
      </div>
      <a className="btn-secundario w-full" href={`/api/painel/fiscal/documentos/${doc.id}`}><Download size={16} aria-hidden="true" /> XML do evento</a>
    </li>
  );
}

function LinhaEventoFiscal({ doc }: { doc: Estado["documentos"][number] }) {
  return (
    <tr>
      <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">{dia(doc.eventoRegistradoEm ?? doc.recebidoEm)}</td>
      <td className="max-w-80 px-3 py-3"><span className="block truncate font-medium" title={nomeEvento(doc)}>{nomeEvento(doc)}</span>{doc.eventoCodigo && <span className="mt-1 block text-xs text-muted-foreground">Código {doc.eventoCodigo}{doc.eventoSequencia != null ? ` · sequência ${doc.eventoSequencia}` : ""}</span>}</td>
      <td className="whitespace-nowrap px-3 py-3">{doc.numero ?? "—"}</td>
      <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">{doc.protocolo ?? "—"}</td>
      <td className="px-3 py-3 text-right"><a className="btn-secundario whitespace-nowrap" href={`/api/painel/fiscal/documentos/${doc.id}`}><Download size={15} aria-hidden="true" /> Evento</a></td>
    </tr>
  );
}
