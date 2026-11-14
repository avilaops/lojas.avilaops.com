"use client";

import { useEffect } from "react";
import { useConsentimento } from "@/lib/consentimento";
import { permissoesDaEscolha } from "@/lib/consentimento-config";
import { normalizarDemandaPk } from "@/lib/pk-demanda-busca";

const enviados = new Set<string>();

/** Montar somente quando a listagem do servidor não encontrou resultados. */
export function EventoDemandaBusca({ tenantSlug, consulta }: { tenantSlug: string; consulta: string }) {
  const consentimento = useConsentimento();
  useEffect(() => {
    if (tenantSlug !== "pkvedacoes" || !permissoesDaEscolha(consentimento).medicao) return;
    const demanda = normalizarDemandaPk(consulta);
    if (!demanda) return;
    const chave = `pk:demanda:v1:${demanda.tipo}:${demanda.consulta}`;
    try { if (sessionStorage.getItem(chave)) return; } catch { /* dedupe em memória quando storage está bloqueado */ }
    if (enviados.has(chave)) return;
    enviados.add(chave);
    void fetch("/api/pk/demandas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ consulta: demanda.consulta, consentido: true }), credentials: "omit", keepalive: true }).then(resposta => {
      if (!resposta.ok) { enviados.delete(chave); return; }
      try { sessionStorage.setItem(chave, "1"); } catch { /* medição nunca bloqueia a vitrine */ }
    }).catch(() => { enviados.delete(chave); });
  }, [tenantSlug, consulta, consentimento]);
  return null;
}
