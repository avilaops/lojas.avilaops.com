"use client";

import { useEffect, useState } from "react";
import { Secao } from "./campos";

type Estado = {
  configuracao: { cnpj: string; uf: string; titular: string; validoAte: string; proximaConsultaEm: string; ultimaMensagem: string | null } | null;
  documentos: Array<{ id: string; nsu: string; schema: string; chave: string | null; recebidoEm: string }>;
};
const UFS = "AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" ");
const data = (valor: string) => new Date(valor).toLocaleString("pt-BR");

export default function Fiscal() {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [erro, setErro] = useState("");
  const [mensagem, setMensagem] = useState("");
  const [ocupado, setOcupado] = useState(false);

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
    setOcupado(true); setErro(""); setMensagem("");
    try {
      const r = await fetch(`/api/painel/fiscal${form ? "" : "?acao=consultar"}`, { method: "POST", ...(form ? { body: new FormData(form) } : {}) });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados.erro ?? "Não foi possível concluir a operação.");
      setEstado(dados);
      setMensagem(form ? "Certificado guardado com segurança." : `${dados.resultado.recebidos} documento(s) recebido(s). ${dados.resultado.mensagem}`);
      form?.reset();
    } catch (e) { setErro(e instanceof Error ? e.message : "Falha ao acessar o serviço."); }
    finally { setOcupado(false); }
  }

  return <div className="grid gap-6">
    <Secao titulo="Certificado digital A1" descricao="Use o certificado .pfx ou .p12 do CNPJ cadastrado em Dados da empresa. Ao guardar, você ativa a busca periódica de notas fiscais.">
      <p className="text-sm text-muted-foreground">Se outro programa consulta as notas deste CNPJ, coordene a consulta com o suporte antes de ativar para evitar bloqueios da SEFAZ.</p>
      {erro && <p role="alert" className="mb-3 text-sm text-red-700">{erro}</p>}
      {mensagem && <p role="status" className="mb-3 text-sm">{mensagem}</p>}
      {estado?.configuracao && <p className="mb-4 text-sm">{estado.configuracao.titular} · CNPJ {estado.configuracao.cnpj} · válido até {data(estado.configuracao.validoAte)}</p>}
      <form className="grid max-w-lg gap-4" onSubmit={(e) => { e.preventDefault(); void enviar(e.currentTarget); }}>
        <label className="grid gap-1 text-sm">Arquivo do certificado<input name="certificado" type="file" accept=".pfx,.p12" required disabled={ocupado} /></label>
        <label className="grid gap-1 text-sm">Senha do certificado<input name="senha" type="password" autoComplete="off" maxLength={1024} className="rounded border p-2" disabled={ocupado} /></label>
        <label className="grid gap-1 text-sm">UF da empresa<select name="uf" defaultValue="" required className="rounded border p-2" disabled={ocupado}><option value="">Selecione</option>{UFS.map((uf) => <option key={uf}>{uf}</option>)}</select></label>
        <button disabled={ocupado || !estado} className="rounded border px-4 py-2 text-sm disabled:opacity-50">{ocupado ? "Aguarde…" : "Guardar certificado"}</button>
      </form>
    </Secao>
    <Secao titulo="Notas fiscais do CNPJ" descricao="Receba NF-e, resumos e eventos disponibilizados pelo Ambiente Nacional da SEFAZ.">
      <p className="mb-3 text-sm text-muted-foreground">A SEFAZ limita o período e os documentos disponíveis. Resumos não substituem o XML completo; algumas notas exigem manifestação do destinatário. NFS-e e NFC-e não entram nesta consulta.</p>
      {estado?.configuracao && <div className="mb-4 grid gap-2 text-sm">
        <p>Próxima consulta a partir de {data(estado.configuracao.proximaConsultaEm)}.</p>
        {estado.configuracao.ultimaMensagem && <p>{estado.configuracao.ultimaMensagem}</p>}
        <button onClick={() => void enviar()} disabled={ocupado} className="w-fit rounded border px-4 py-2 disabled:opacity-50">Consultar próximo lote</button>
      </div>}
      {!estado ? <p role="status">Carregando configuração fiscal…</p> : !estado.documentos.length ? <p className="text-sm">Nenhum documento recebido ainda.</p> : <div className="overflow-x-auto"><table className="w-full text-left text-sm"><caption className="mb-2 text-left">Últimos 100 documentos recebidos</caption><thead><tr><th className="p-2">Recebido em</th><th className="p-2">Documento</th><th className="p-2">XML</th></tr></thead><tbody>{estado.documentos.map((doc) => <tr key={doc.id} className="border-t"><td className="p-2">{data(doc.recebidoEm)}</td><td className="p-2"><span className="block">{doc.schema}</span><span className="break-all">{doc.chave ?? `NSU ${doc.nsu}`}</span></td><td className="p-2"><a className="underline" href={`/api/painel/fiscal/documentos/${doc.id}`}>Baixar XML</a></td></tr>)}</tbody></table></div>}
    </Secao>
  </div>;
}
