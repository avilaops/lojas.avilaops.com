"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Search, Store, X } from "lucide-react";
import { filtrarLojas } from "@/lib/busca-lojas";

type Loja = { slug: string; nome: string; status: string; dominioPrincipal: string | null };
const SITUACAO: Record<string, string> = { ATIVA: "Ativa", SUSPENSA: "Suspensa", PROVISIONANDO: "Em provisionamento" };

export default function SeletorLojasEquipe({ lojas, base }: { lojas: Loja[]; base: string }) {
  const [busca, setBusca] = useState("");
  const [entrando, setEntrando] = useState<string | null>(null);
  const envioIniciado = useRef(false);
  const campo = useRef<HTMLInputElement>(null);
  const filtradas = filtrarLojas(lojas, busca, base);

  useEffect(() => {
    // O navegador pode restaurar esta tela com os botões ainda desabilitados.
    function restaurar(evento: PageTransitionEvent) {
      if (!evento.persisted) return;
      envioIniciado.current = false;
      setEntrando(null);
    }
    window.addEventListener("pageshow", restaurar);
    return () => window.removeEventListener("pageshow", restaurar);
  }, []);

  function limpar() {
    setBusca("");
    campo.current?.focus();
  }

  return (
    <section aria-label="Lojas disponíveis" className="eq-seletor">
      <div className="eq-busca">
        <label htmlFor="buscar-lojas">Encontrar uma loja</label>
        <div className="eq-busca-campo">
          <Search size={20} aria-hidden="true" />
          <input ref={campo} id="buscar-lojas" type="search" value={busca}
            placeholder="Nome, endereço ou identificação da loja" autoComplete="off"
            aria-controls="lojas-equipe" onChange={(e) => setBusca(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Escape") limpar(); }} />
          {busca && <button type="button" onClick={limpar} aria-label="Limpar busca"><X size={18} aria-hidden="true" /></button>}
        </div>
      </div>
      <p className="eq-contagem" role="status" aria-live="polite" aria-atomic="true">
        {filtradas.length} {filtradas.length === 1 ? "loja disponível" : "lojas disponíveis"}
        {busca.trim() && ` para “${busca.trim()}”`}
      </p>
      <ul id="lojas-equipe" className="eq-lojas" aria-busy={entrando !== null}>
        {filtradas.map((loja) => (
          <li key={loja.slug}>
            <form action="/api/painel/entrar/equipe" method="post" onSubmit={(e) => {
              if (envioIniciado.current) { e.preventDefault(); return; }
              envioIniciado.current = true;
              setEntrando(loja.slug);
            }}>
              <input type="hidden" name="slug" value={loja.slug} />
              <button type="submit" className="eq-loja" disabled={entrando !== null}>
                <span className="eq-loja-icone"><Store size={22} aria-hidden="true" /></span>
                <span className="eq-loja-info">
                  <strong>{loja.nome}</strong>
                  <span>{loja.dominioPrincipal ?? `${loja.slug}.${base}`}</span>
                  <span className="eq-loja-status" data-status={loja.status}>{SITUACAO[loja.status] ?? loja.status}</span>
                </span>
                <span className="eq-loja-acao">{entrando === loja.slug ? "Entrando…" : "Entrar"}<ArrowRight size={18} aria-hidden="true" /></span>
              </button>
            </form>
          </li>
        ))}
      </ul>
      {filtradas.length === 0 && <div className="eq-vazio">
        <Store size={28} aria-hidden="true" />
        <h2>{lojas.length ? "Nenhuma loja encontrada" : "Nenhuma loja disponível"}</h2>
        <p>{lojas.length ? "Tente outro nome ou pesquise pelo endereço da loja." : "As lojas aparecem aqui quando o cadastro estiver disponível para a equipe."}</p>
        {busca && <button type="button" onClick={limpar}>Limpar busca</button>}
      </div>}
    </section>
  );
}
