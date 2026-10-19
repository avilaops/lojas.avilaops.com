"use client";
import { useState } from "react";
import { RefreshCw } from "lucide-react";
export default function BuscarXmlFiscal({ id }: { id: string }) {
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  return <div className="grid gap-1">
    <button type="button" disabled={ocupado} className="btn-secundario whitespace-nowrap" onClick={async () => {
      setOcupado(true); setMensagem("");
      try {
        const resposta = await fetch(`/api/painel/fiscal/documentos/${id}/buscar`, { method: "POST" });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.erro ?? "Consulta indisponível.");
        if (dados.disponivel) window.location.reload();
        else setMensagem(dados.mensagem ?? "XML completo não localizado.");
      } catch (e) { setMensagem(e instanceof Error ? e.message : "Consulta indisponível."); }
      finally { setOcupado(false); }
    }}><RefreshCw size={15} aria-hidden="true" /> {ocupado ? "Consultando..." : "Buscar XML na SEFAZ"}</button>
    {mensagem && <span role="status" className="text-xs text-muted-foreground">{mensagem}</span>}
  </div>;
}
