"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { chaveComparacaoPk, eventoComparacaoPk, lerSelecaoPk, LIMITE_COMPARACAO, TENANT_PK } from "@/lib/pk-produtos";

/** O servidor monta a barra apenas na loja ativa; o guard também isola o cliente. */
export default function FerramentasPk({ tenantSlug }: { tenantSlug: string }) {
  const [selecao, setSelecao] = useState<string[]>([]);
  const [erro, setErro] = useState("");
  useEffect(() => {
    if (tenantSlug !== TENANT_PK) return;
    const atualizar = () => {
      try { setSelecao(lerSelecaoPk(sessionStorage.getItem(chaveComparacaoPk))); setErro(""); }
      catch { setSelecao([]); setErro("O armazenamento da sessão está indisponível. Abra as fichas dos produtos para comparar os dados."); }
    };
    atualizar();
    window.addEventListener(eventoComparacaoPk, atualizar);
    window.addEventListener("storage", atualizar);
    return () => { window.removeEventListener(eventoComparacaoPk, atualizar); window.removeEventListener("storage", atualizar); };
  }, [tenantSlug]);
  if (tenantSlug !== TENANT_PK) return null;
  const consulta = new URLSearchParams(selecao.map(slug => ["produto", slug]));
  function limpar() {
    try { sessionStorage.removeItem(chaveComparacaoPk); window.dispatchEvent(new Event(eventoComparacaoPk)); }
    catch { setErro("Não foi possível limpar a seleção neste navegador."); }
  }
  return <aside className="my-5 space-y-3 rounded-xl border border-border bg-card p-4" aria-label="Ferramentas do catálogo PK">
    <div className="flex flex-wrap items-center gap-3">
      <span role="status" className="text-sm">{selecao.length} de {LIMITE_COMPARACAO} produtos selecionados</span>
      <Link href={`/comparar${selecao.length ? `?${consulta.toString()}` : ""}`} className="rounded-lg border px-3 py-2 text-sm font-semibold">Comparar produtos</Link>
      {selecao.length > 0 && <button type="button" onClick={limpar} className="rounded-lg border px-3 py-2 text-sm">Limpar seleção</button>}
    </div>
    <nav aria-label="Apoio à seleção de vedações" className="flex flex-wrap gap-x-5 gap-y-2 text-sm underline"><Link href="/cotacao-lote">Cotação em lote</Link><Link href="/guias">Guias de seleção</Link><Link href="/aplicacoes">Aplicações</Link></nav>
    <p className="text-xs text-muted-foreground">Selecione até 3 peças em Comparar produto. A seleção fica nesta sessão do navegador; confirme material, perfil, medidas e aplicação antes de substituir uma peça.</p>
    {erro && <p role="status" className="text-sm">{erro}</p>}
  </aside>;
}
