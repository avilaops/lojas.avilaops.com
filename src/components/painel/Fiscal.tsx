"use client";

import { useEffect, useId, useState } from "react";
import { Download, FileText, RefreshCw, ShieldCheck, Upload } from "lucide-react";
import { Secao, inputClasse } from "./campos";

type Estado = {
  configuracao: { cnpj: string; uf: string; titular: string; validoAte: string; proximaConsultaEm: string; ultimaMensagem: string | null } | null;
  documentos: Array<{ id: string; nsu: string; schema: string; chave: string | null; recebidoEm: string }>;
  ufEmpresa: string;
};
const data = (valor: string) => new Date(valor).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
const dia = (valor: string) => new Date(valor).toLocaleDateString("pt-BR");
const cnpjFormatado = (cnpj: string) => cnpj.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, "$1.$2.$3/$4-$5");

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
        {configuracao && (
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
        {!estado ? <p role="status" className="text-sm text-muted-foreground">Carregando documentos…</p> : !estado.documentos.length ? (
          <div className="py-4 text-center">
            <FileText size={28} aria-hidden="true" className="mx-auto mb-3 text-muted-foreground" />
            <p className="text-sm font-medium">Nenhum documento recebido ainda.</p>
            <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">{configuracao ? "Consulte o próximo lote para buscar documentos disponíveis." : "Guarde o certificado acima para iniciar a busca."}</p>
          </div>
        ) : (
          <div className="min-w-0">
            <p className="mb-3 text-xs text-muted-foreground">Últimos 100 documentos recebidos · {estado.documentos.length} nesta lista</p>
            <ul className="divide-y divide-border">
              {estado.documentos.map((doc) => (
                <li key={doc.id} className="grid min-w-0 gap-3 py-4 first:pt-0 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{tipoDocumento(doc.schema)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Recebido em {data(doc.recebidoEm)}</p>
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
              ))}
            </ul>
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
