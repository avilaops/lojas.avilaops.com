"use client";

import { useState } from "react";

/** Botão de upload que devolve a URL pública da imagem. */
export default function EnviarImagem({ aoEnviar, rotulo = "Enviar imagem" }: { aoEnviar: (url: string) => void; rotulo?: string }) {
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(arquivo: File) {
    setErro(null);
    setOcupado(true);
    try {
      const fd = new FormData();
      fd.append("arquivo", arquivo);
      const r = await fetch("/api/painel/imagens", { method: "POST", body: fd });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Falha no envio.");
      aoEnviar(d.url);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <label className={`btn-secundario h-9 cursor-pointer px-3 text-xs ${ocupado ? "opacity-50" : ""}`}>
        {ocupado ? "Enviando…" : rotulo}
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" className="hidden" disabled={ocupado} onChange={(e) => e.target.files?.[0] && enviar(e.target.files[0])} />
      </label>
      {erro && <span className="text-xs text-red-700">{erro}</span>}
    </span>
  );
}
