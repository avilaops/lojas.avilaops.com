"use client";

import { useState } from "react";
import { ESCOLHA_PADRAO, type EscolhaDeAcesso as Escolha } from "@/lib/mcp-permissoes";
import EscolhaDeAcesso, { escolhaVazia } from "./EscolhaDeAcesso";

/**
 * A escolha e os dois botões da tela de autorização do conector.
 *
 * O que o lojista marca aqui é o que a conexão vai poder, e fica gravado nela
 * (`ConexaoMcp.escopos`). Depois dá para mudar no painel, em IA e API.
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
  const [escolha, setEscolha] = useState<Escolha>(ESCOLHA_PADRAO);
  const [enviando, setEnviando] = useState<"permitir" | "negar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function decidir(decisao: "permitir" | "negar") {
    setEnviando(decisao);
    setErro(null);
    try {
      const r = await fetch("/api/painel/mcp/autorizar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(decisao === "permitir" ? { decisao, ...escolha } : { decisao }),
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

  const nadaMarcado = escolhaVazia(escolha);

  return (
    <div className="mt-6 grid gap-3">
      {impedimento && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{impedimento}</p>}
      {!impedimento && <EscolhaDeAcesso nome="nivel" valor={escolha} aoMudar={setEscolha} />}

      {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
      {!impedimento && (
        <button type="button" className="btn-primario w-full justify-center" disabled={enviando !== null || nadaMarcado} onClick={() => decidir("permitir")}>
          {enviando === "permitir" ? "Conectando…" : nadaMarcado ? "Marque ao menos uma área" : "Autorizar"}
        </button>
      )}
      <button type="button" className="btn-secundario w-full justify-center" disabled={enviando !== null} onClick={() => decidir("negar")}>
        {enviando === "negar" ? "Voltando…" : impedimento ? "Voltar ao assistente" : "Não conectar"}
      </button>
    </div>
  );
}
