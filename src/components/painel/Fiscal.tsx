"use client";

import { useEffect, useId, useState } from "react";
import { Download, ExternalLink, FileText, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { separarDocumentosFiscais } from "@/lib/fiscal-monitor";
import { Secao, inputClasse } from "./campos";

type Estado = {
  configuracao: { cnpj: string; uf: string; titular: string; validoAte: string; proximaConsultaEm: string; ultimaMensagem: string | null } | null;
  documentos: Array<{ id: string; nsu: string; schema: string; chave: string | null; recebidoEm: string; fornecedor: string | null; numero: string | null; valorCentavos: number | null; emitidaEm: string | null; situacao: "COMPLETA" | "RESUMO" | "OUTRO" }>;
  ufEmpresa: string;
  erp: { notas: Array<{ id: number; chave: string; numero: number; serie: number; emitida_em: string; valor: number; fornecedor: { documento: string; nome: string; vinculado: boolean; id: number | null }; itens: number; compra_id: number | null }>; painelUrl: string } | { erro: string } | null;
};
const data = (valor: string) => new Date(valor).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const dia = (valor: string) => new Date(valor).toLocaleDateString("pt-BR");
const cnpjFormatado = (cnpj: string) => cnpj.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, "$1.$2.$3/$4-$5");
const dinheiro = (centavos: number | null) => centavos == null ? "—" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(centavos / 100);

function tipoDocumento(schema: string) {
  if (schema.startsWith("resNFe")) return "Resumo de NF-e";
  if (schema.startsWith("procNFe")) return "NF-e completa";
  if (/evento/i.test(schema)) return "Evento da NF-e";
  return "Documento fiscal";
}

export default function Fiscal() {
  const arquivoId = useId();
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState<"certificado" | "consulta" | null>(null);
  const [arquivoNome, setArquivoNome] = useState("");
  const [agora] = useState(() => Date.now());

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/painel/fiscal", { signal: controller.signal }).then(async (r) => {
      const dados = await r.json();
      if (!r.ok) throw new Error(dados.erro);
      setEstado(dados);
    }).catch((e) => { if (e.name !== "AbortError") setErro(e.message); });
    return () => controller.abort();
  }, []);

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

  const configuracao = estado?.configuracao;
  const documentosSeparados = separarDocumentosFiscais(estado?.documentos ?? []);
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
              <div className="grid min-w-0 gap-3">
                <span className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${vencido ? "bg-amber-100 text-amber-900" : "bg-emerald-50 text-emerald-800"}`}>
                  {vencido ? "Certificado vencido" : "Certificado válido"}
                </span>
                <p className="break-words text-sm font-semibold">{configuracao.titular.replace(new RegExp(`:${configuracao.cnpj}$`), "")}</p>
                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-muted-foreground">CNPJ</dt><dd className="mt-1">{cnpjFormatado(configuracao.cnpj)}</dd></div>
                  <div><dt className="text-xs text-muted-foreground">Válido até</dt><dd className="mt-1">{dia(configuracao.validoAte)}</dd></div>
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

      <Secao titulo="Notas fiscais do CNPJ" descricao="Documentos recebidos da SEFAZ para esta empresa.">
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
              {ocupado === "consulta" ? "Consultando…" : "Consultar próximo lote"}
            </button>
          </div>
        )}
        {estado?.erp && "erro" in estado.erp && <p role="status" className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Integração com o ERP: {estado.erp.erro}</p>}
        {estado?.erp && "notas" in estado.erp && (
          <div className="mb-5 grid min-w-0 gap-3 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-semibold">Conferência operacional no ERP</h3><p className="mt-1 text-xs text-muted-foreground">XML completo, DANFE, fornecedor, produtos, compra, custos e estoque ficam em uma única escrituração.</p></div><a className="btn-secundario" href={estado.erp.painelUrl}><ExternalLink size={15} aria-hidden="true" /> Gerenciar no ERP</a></div>
            <p className="text-xs text-muted-foreground">A consulta à SEFAZ deste CNPJ é feita somente pelo ERP para preservar a sequência NSU.</p>
            {!estado.erp.notas.length ? <p className="text-sm text-muted-foreground">O ERP ainda não registrou NF-e completa para esta empresa.</p> : <ul className="divide-y divide-border">{estado.erp.notas.map((nota) => <li key={nota.id} className="grid gap-2 py-3 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"><div className="min-w-0"><div className="flex items-start justify-between gap-3"><p className="font-semibold">{nota.fornecedor.nome}</p><strong className="shrink-0 text-sm">{dinheiro(Math.round(nota.valor * 100))}</strong></div><p className="mt-1 text-xs text-muted-foreground">NF-e {nota.numero} · série {nota.serie} · {nota.itens} item(ns) · {data(nota.emitida_em)}</p><p className="mt-1 text-xs text-muted-foreground">{nota.fornecedor.vinculado ? "Fornecedor vinculado" : "Fornecedor pendente"} · {nota.compra_id ? `Compra #${nota.compra_id} criada` : "Compra e custos pendentes"}</p></div><div className="flex flex-wrap gap-2"><a className="btn-secundario" href={`/api/painel/fiscal/erp/documentos/${nota.id}/xml`}><Download size={15} aria-hidden="true" /> XML</a><a className="btn-secundario" href={`/api/painel/fiscal/erp/documentos/${nota.id}/danfe`}><FileText size={15} aria-hidden="true" /> PDF</a></div></li>)}</ul>}
          </div>
        )}
        {!estado ? <p role="status" className="text-sm text-muted-foreground">Carregando documentos…</p> : !estado.documentos.length ? (
          <div className="py-4 text-center">
            <FileText size={28} aria-hidden="true" className="mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Nenhum documento recebido ainda.</p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{configuracao ? "Consulte o próximo lote para buscar documentos disponíveis." : "Guarde o certificado acima para iniciar a busca."}</p>
          </div>
        ) : (
          <div className="grid min-w-0 gap-5">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">NF-e encontradas</p>
                <p className="mt-1 text-2xl font-semibold">{documentosSeparados.notas.length}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">Eventos fiscais</p>
                <p className="mt-1 text-2xl font-semibold">{documentosSeparados.eventos.length}</p>
              </div>
            </div>
            <div className="min-w-0">
              <h3 className="mb-1 text-sm font-semibold">Notas fiscais</h3>
              <p className="mb-3 text-xs text-muted-foreground">Resumos e XML completos encontrados entre os últimos 100 documentos.</p>
              {!documentosSeparados.notas.length ? <p className="rounded-xl border border-border p-4 text-sm text-muted-foreground">Nenhuma NF-e encontrada neste lote.</p> : (
                <>
                  <ul className="divide-y divide-border sm:hidden">
                    {documentosSeparados.notas.map((doc) => <DocumentoFiscal key={doc.id} doc={doc} />)}
                  </ul>
                  <div className="hidden overflow-x-auto rounded-xl border border-border sm:block">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-3">Recebida</th><th className="px-3 py-3">Fornecedor</th><th className="px-3 py-3">Nota</th><th className="px-3 py-3 text-right">Valor</th><th className="px-3 py-3">Situação</th><th className="px-3 py-3" /></tr></thead>
                      <tbody className="divide-y divide-border">{documentosSeparados.notas.map((doc) => <LinhaDocumentoFiscal key={doc.id} doc={doc} />)}</tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
            <details className="min-w-0 border-t border-border pt-4">
              <summary className="cursor-pointer text-sm font-medium">Eventos e outros documentos ({documentosSeparados.eventos.length + documentosSeparados.outros.length})</summary>
              <ul className="mt-3 divide-y divide-border">
                {[...documentosSeparados.eventos, ...documentosSeparados.outros].map((doc) => (
                  <DocumentoFiscal key={doc.id} doc={doc} />
                ))}
              </ul>
            </details>
            <p className="text-xs text-muted-foreground">Últimos 100 documentos recebidos · {estado.documentos.length} nesta lista</p>
          </div>
        )}
        <details className="border-t border-border pt-4 text-sm">
          <summary className="cursor-pointer font-medium">Sobre esta consulta</summary>
          <div className="mt-3 grid gap-3 text-sm leading-relaxed text-muted-foreground">
            <p>A SEFAZ limita o período e os documentos disponíveis. Esta consulta não recupera todo o histórico do CNPJ e não inclui NFS-e ou NFC-e.</p>
            <p>Resumos não substituem o XML completo. Algumas notas exigem manifestação do destinatário, que não é enviada por esta tela.</p>
            <p>Se outro programa consulta este CNPJ, coordene o uso com o suporte antes de ativar para evitar bloqueios da SEFAZ.</p>
          </div>
        </details>
      </Secao>
    </div>
  );
}

function DocumentoFiscal({ doc }: { doc: Estado["documentos"][number] }) {
  return (
    <li className="grid min-w-0 gap-3 py-4 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="min-w-0">
        <div className="flex items-start justify-between gap-3"><p className="min-w-0 text-sm font-semibold">{doc.fornecedor ?? tipoDocumento(doc.schema)}</p><strong className="shrink-0 text-sm">{dinheiro(doc.valorCentavos)}</strong></div>
        <p className="mt-1 text-xs text-muted-foreground">{doc.numero ? `Nota ${doc.numero} · ` : ""}Recebida em {data(doc.recebidoEm)}</p>
        {doc.schema.startsWith("resNFe") && <p className="mt-2 text-xs text-amber-900">Resumo: este arquivo não é a nota completa.</p>}
        <details className="mt-2 min-w-0 text-xs text-muted-foreground">
          <summary className="cursor-pointer py-1">Identificação do documento</summary>
          <dl className="mt-2 grid gap-2">
            {doc.chave && <div><dt>Chave de acesso</dt><dd className="break-all text-foreground">{doc.chave}</dd></div>}
            <div><dt>NSU</dt><dd className="break-all text-foreground">{doc.nsu}</dd></div>
            <div><dt>Formato recebido</dt><dd className="break-all">{doc.schema}</dd></div>
          </dl>
        </details>
      </div>
      <a className="btn-secundario w-full sm:w-auto" href={`/api/painel/fiscal/documentos/${doc.id}`}>
        <Download size={16} aria-hidden="true" /> Baixar XML
      </a>
    </li>
  );
}

function LinhaDocumentoFiscal({ doc }: { doc: Estado["documentos"][number] }) {
  const situacao = doc.situacao === "COMPLETA" ? "Pronta para revisão" : doc.situacao === "RESUMO" ? "Aguardando XML completo" : "Documento recebido";
  return (
    <tr>
      <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">{dia(doc.recebidoEm)}</td>
      <td className="max-w-64 px-3 py-3"><span className="block truncate font-medium" title={doc.fornecedor ?? undefined}>{doc.fornecedor ?? "Fornecedor não informado"}</span></td>
      <td className="whitespace-nowrap px-3 py-3">{doc.numero ?? "—"}</td>
      <td className="whitespace-nowrap px-3 py-3 text-right font-medium tabular-nums">{dinheiro(doc.valorCentavos)}</td>
      <td className="px-3 py-3 text-xs text-muted-foreground">{situacao}</td>
      <td className="px-3 py-3 text-right"><a className="btn-secundario whitespace-nowrap" href={`/api/painel/fiscal/documentos/${doc.id}`}><Download size={15} aria-hidden="true" /> XML</a></td>
    </tr>
  );
}
