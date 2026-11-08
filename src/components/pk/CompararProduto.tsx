"use client";

import { useEffect, useState } from "react";
import { chaveComparacaoPk, eventoComparacaoPk, lerSelecaoPk, slugsComparacao, TENANT_PK } from "@/lib/pk-produtos";

export function CompararProduto({ tenantSlug, slug, nome }: { tenantSlug: string; slug: string; nome?: string }) {
  const [selecionado, setSelecionado] = useState(false);
  const [mensagem, setMensagem] = useState("");
  useEffect(() => {
    const atualizar = () => { try { setSelecionado(lerSelecaoPk(sessionStorage.getItem(chaveComparacaoPk)).includes(slug)); } catch { setMensagem("A seleção exige armazenamento disponível neste navegador."); } };
    atualizar(); window.addEventListener(eventoComparacaoPk, atualizar);
    return () => window.removeEventListener(eventoComparacaoPk, atualizar);
  }, [slug]);
  if (tenantSlug !== TENANT_PK || !slugsComparacao([slug])) return null;
  function alternar() {
    try {
      const atual = lerSelecaoPk(sessionStorage.getItem(chaveComparacaoPk));
      const proxima = atual.includes(slug) ? atual.filter(s => s !== slug) : [...atual, slug];
      if (proxima.length > 3) { setMensagem("Compare até 3 produtos. Remova um para continuar."); return; }
      sessionStorage.setItem(chaveComparacaoPk, JSON.stringify(proxima));
      setMensagem(""); window.dispatchEvent(new Event(eventoComparacaoPk));
    } catch { setMensagem("Não foi possível salvar a seleção neste navegador."); }
  }
  return <span className="inline-flex flex-col gap-1"><button type="button" onClick={alternar} aria-pressed={selecionado} aria-label={`${selecionado ? "Remover da comparação" : "Comparar"}${nome ? `: ${nome}` : ""}`} className="rounded-lg border px-3 py-2 text-sm">{selecionado ? "Remover da comparação" : "Comparar produto"}</button><span role="status" className="text-sm">{mensagem}</span></span>;
}
