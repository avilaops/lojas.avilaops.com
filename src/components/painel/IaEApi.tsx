"use client";

import { useSyncExternalStore } from "react";
import { Bot, KeyRound, Webhook } from "lucide-react";
import McpPainel from "./McpPainel";
import ChavesApiPainel from "./ChavesApiPainel";
import WebhooksPainel from "./WebhooksPainel";

/**
 * As três áreas de IA e API, uma por vez.
 *
 * Empilhadas, a tela tinha mais de duas mil linhas de altura no celular e quem
 * vinha revogar uma chave rolava por todo o conector antes de chegar nela. A
 * área aberta vai no endereço (`#chaves`, `#webhooks`), para um link ou o
 * botão de outra área abrir a certa.
 */
const AREAS = [
  { id: "assistente", rotulo: "Assistente de IA", Icone: Bot },
  { id: "chaves", rotulo: "Chaves da API", Icone: KeyRound },
  { id: "webhooks", rotulo: "Webhooks", Icone: Webhook },
] as const;

type Area = (typeof AREAS)[number]["id"];

const areaDoEndereco = (): Area => {
  const marcada = typeof window === "undefined" ? "" : window.location.hash.slice(1);
  return AREAS.some((a) => a.id === marcada) ? (marcada as Area) : "assistente";
};

function assinarEndereco(aoMudar: () => void) {
  window.addEventListener("hashchange", aoMudar);
  return () => window.removeEventListener("hashchange", aoMudar);
}

export default function IaEApi({ lojaPlano, lojaSlug, aoIrParaAssinatura }: { lojaPlano: string; lojaSlug: string; aoIrParaAssinatura: () => void }) {
  // A área aberta É o endereço: quem lê é o próprio React, e no servidor (onde
  // não há endereço) vale a primeira área.
  const area = useSyncExternalStore(assinarEndereco, areaDoEndereco, () => "assistente" as Area);

  function abrir(proxima: Area) {
    // `replaceState` não avisa ninguém: o evento é disparado à mão. Trocar de
    // área não entra no histórico, para o "voltar" sair da tela e não desfazer abas.
    window.history.replaceState(null, "", `#${proxima}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="grid min-w-0 gap-4">
      <div role="tablist" aria-label="Áreas de IA e API" className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-card p-1">
        {AREAS.map(({ id, rotulo, Icone }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`aba-${id}`}
            aria-selected={area === id}
            aria-controls={`area-${id}`}
            onClick={() => abrir(id)}
            className={`flex min-h-11 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg px-1 py-1.5 text-[11px] font-semibold leading-tight transition sm:flex-row sm:gap-1.5 sm:text-sm ${area === id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
          >
            <Icone className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="text-center">{rotulo}</span>
          </button>
        ))}
      </div>

      <div role="tabpanel" id={`area-${area}`} aria-labelledby={`aba-${area}`} className="grid min-w-0 gap-4">
        {area === "assistente" && (
          <McpPainel lojaPlano={lojaPlano} lojaSlug={lojaSlug} aoIrParaAssinatura={aoIrParaAssinatura} aoIrParaChaves={() => abrir("chaves")} />
        )}
        {area === "chaves" && <ChavesApiPainel />}
        {area === "webhooks" && <WebhooksPainel />}
      </div>
    </div>
  );
}
