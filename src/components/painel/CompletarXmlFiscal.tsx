"use client";

import { useState } from "react";
import { Upload } from "lucide-react";

export default function CompletarXmlFiscal({ id }: { id: string }) {
  const [ocupado, setOcupado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  return <label className="btn-secundario relative cursor-pointer whitespace-nowrap" title="Enviar XML completo obtido do fornecedor ou de fonte autorizada">
    <Upload size={15} aria-hidden="true" /> {ocupado ? "Validando..." : "Importar XML completo"}
    <input type="file" accept=".xml,application/xml,text/xml" className="sr-only" disabled={ocupado} aria-label="Importar XML completo desta NF-e" onChange={async (event) => {
      const arquivo = event.target.files?.[0];
      if (!arquivo) return;
      if (arquivo.size > 3 * 1024 * 1024) { setMensagem("Arquivo maior que 3 MB."); return; }
      setOcupado(true); setMensagem("");
      try {
        const resposta = await fetch(`/api/painel/fiscal/documentos/${id}/completar`, { method: "POST", headers: { "Content-Type": "application/xml" }, body: arquivo });
        const dados = await resposta.json();
        if (!resposta.ok) throw new Error(dados.erro ?? "Importação não concluída.");
        window.location.reload();
      } catch (e) { setMensagem(e instanceof Error ? e.message : "Importação não concluída."); }
      finally { setOcupado(false); event.target.value = ""; }
    }} />
    {mensagem && <span role="alert" className="block whitespace-normal text-xs text-red-700">{mensagem}</span>}
  </label>;
}
