"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import type { instalarFerramentasPublicas } from "@avilaops/publicacao-texto/descoberta/navegador";
import { paginaPermiteDescoberta } from "@/lib/descoberta-contexto";

type ContextoModelo = Parameters<typeof instalarFerramentasPublicas>[0]["modelContext"];

/** Melhoria progressiva: só importa o adaptador se o browser expuser a API. */
export default function DescobertaPublica({ habilitada, plataforma = false }: { habilitada: boolean; plataforma?: boolean }) {
  const caminho = usePathname();
  const consulta = useSearchParams().toString();
  const publica = habilitada && paginaPermiteDescoberta(caminho, consulta, plataforma);
  useEffect(() => {
    if (!publica) return;
    const modelContext = (document as Document & { modelContext?: ContextoModelo }).modelContext
      ?? (navigator as Navigator & { modelContext?: ContextoModelo }).modelContext;
    if (!modelContext) return;
    if ([...document.head.querySelectorAll("meta[name]")].some((meta) => /^(robots|googlebot|bingbot)$/i.test(meta.getAttribute("name") ?? "") && /\b(noindex|none)\b/i.test(meta.getAttribute("content") ?? ""))) return;
    const controlador = new AbortController();
    const marcador = document.createElement("meta");
    marcador.name = "descoberta-publica";
    marcador.content = "true";
    marcador.dataset.descobertaPublica = "true";
    document.head.append(marcador);
    controlador.signal.addEventListener("abort", () => marcador.remove(), { once: true });
    void import("@avilaops/publicacao-texto/descoberta/navegador").then(({ instalarFerramentasPublicas }) => {
      if (!controlador.signal.aborted) return instalarFerramentasPublicas({ documento: document, modelContext, localizacao: window.location, controlador });
    }).catch(() => controlador.abort());
    return () => controlador.abort();
  }, [publica, caminho, consulta]);
  return null;
}
