"use client";

import { useState } from "react";

/**
 * Os dois botões da tela de autorização do conector.
 *
 * A decisão vai por `fetch` e a volta ao assistente é uma navegação inteira
 * (`location.assign`): o retorno é outro site, ou um programa na máquina do
 * lojista, e o roteador do Next não navega para isso.
 *
 * "Não conectar" também volta ao assistente, com a recusa: sem isso ele fica
 * esperando uma resposta que nunca chega.
 */
export default function AutorizarConexao({
  podeAutorizar,
  planoPermite,
  lojaAtiva,
}: {
  podeAutorizar: boolean;
  planoPermite: boolean;
  lojaAtiva: boolean;
}) {
  const [enviando, setEnviando] = useState<"permitir" | "negar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function decidir(decisao: "permitir" | "negar") {
    setEnviando(decisao);
    setErro(null);
    try {
      const r = await fetch("/api/painel/mcp/autorizar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ decisao }),
      });
      const d = (await r.json().catch(() => null)) as { ir?: string; erro?: string } | null;
      if (!r.ok || !d?.ir) throw new Error(d?.erro ?? "Não foi possível concluir. Tente de novo.");
      window.location.assign(d.ir);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível concluir. Tente de novo.");
      setEnviando(null);
    }
  }

  const impedimento = !podeAutorizar
    ? "Seu acesso não permite conectar um assistente. Peça ao dono ou a um gerente da loja."
    : !planoPermite
      ? "O conector de IA faz parte do plano Loja Pro. Faça o upgrade em Painel, Assinatura, e conecte de novo."
      : !lojaAtiva
        ? "A loja precisa estar ativa para conectar um assistente."
        : null;

  return (
    <div className="mt-6 grid gap-3">
      {impedimento && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{impedimento}</p>}
      {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {!impedimento && (
        <button type="button" className="btn-primario w-full justify-center" disabled={enviando !== null} onClick={() => decidir("permitir")}>
          {enviando === "permitir" ? "Conectando…" : "Autorizar"}
        </button>
      )}
      <button type="button" className="btn-secundario w-full justify-center" disabled={enviando !== null} onClick={() => decidir("negar")}>
        {enviando === "negar" ? "Voltando…" : impedimento ? "Voltar ao assistente" : "Não conectar"}
      </button>
    </div>
  );
}
