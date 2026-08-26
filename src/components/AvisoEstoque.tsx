"use client";

import { useState } from "react";

/**
 * Aparece no lugar do botão de comprar quando o produto acabou. Pede só o
 * e-mail: quanto menor o formulário, mais gente entra na fila — e a fila é o
 * que diz ao lojista o que repor primeiro.
 */
export default function AvisoEstoque({ produtoId }: { produtoId: string }) {
  const [email, setEmail] = useState("");
  const [isca, setIsca] = useState("");
  const [estado, setEstado] = useState<"parado" | "enviando" | "pronto">("parado");
  const [erro, setErro] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEstado("enviando");
    try {
      const r = await fetch("/api/avise-me", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ produtoId, email, site: isca }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Não consegui registrar agora.");
      setEstado("pronto");
    } catch (erroDoEnvio) {
      setErro(erroDoEnvio instanceof Error ? erroDoEnvio.message : "Não consegui registrar agora.");
      setEstado("parado");
    }
  }

  if (estado === "pronto") {
    return <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">Avisamos você por e-mail assim que este produto voltar.</p>;
  }

  return (
    <form onSubmit={enviar} className="rounded-lg border border-border bg-muted/40 p-3">
      <p className="text-sm font-semibold">Produto esgotado</p>
      <p className="mt-0.5 text-xs text-muted-foreground">Deixe seu e-mail e avisamos assim que chegar.</p>
      <div className="mt-2 flex gap-2">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          aria-label="Seu e-mail"
          className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
        />
        <button className="btn-primario h-10 shrink-0 px-4 text-sm" disabled={estado === "enviando"}>
          {estado === "enviando" ? "…" : "Avise-me"}
        </button>
      </div>
      {/* Campo-isca: fica fora da vista e do foco; robô preenche, gente não. */}
      <input tabIndex={-1} autoComplete="off" aria-hidden="true" value={isca} onChange={(e) => setIsca(e.target.value)} name="site" className="absolute left-[-9999px] h-0 w-0 opacity-0" />
      {erro && <p className="mt-1 text-xs text-red-700">{erro}</p>}
    </form>
  );
}
