"use client";

import { useState } from "react";
import { AREAS, type AcessoDaArea, type IdDaArea } from "@/lib/mcp-permissoes";

type Nivel = "completo" | "leitura" | "areas";

const NIVEIS: { id: Nivel; nome: string; descricao: string }[] = [
  { id: "completo", nome: "Consultar e alterar", descricao: "Lê e altera a loja: produtos, preços, estoque, pedidos e cupons." },
  { id: "leitura", nome: "Só consultar", descricao: "Lê tudo e não altera nada. Bom para relatórios e para tirar dúvidas." },
  { id: "areas", nome: "Escolher por área", descricao: "Você decide o que ele vê e o que ele altera." },
];

const SEM_ACESSO = Object.fromEntries(AREAS.map((a) => [a.id, "nenhum"])) as Record<IdDaArea, AcessoDaArea>;

/**
 * A escolha e os dois botões da tela de autorização do conector.
 *
 * O que o lojista marca aqui é o que a conexão vai poder, e fica gravado nela
 * (`ConexaoMcp.escopos`): para mudar depois, ele desconecta e conecta de novo.
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
  const [nivel, setNivel] = useState<Nivel>("completo");
  const [areas, setAreas] = useState(SEM_ACESSO);
  const [enviando, setEnviando] = useState<"permitir" | "negar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function decidir(decisao: "permitir" | "negar") {
    setEnviando(decisao);
    setErro(null);
    try {
      const r = await fetch("/api/painel/mcp/autorizar", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(decisao === "permitir" ? { decisao, nivel, areas } : { decisao }),
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

  const nadaMarcado = nivel === "areas" && Object.values(areas).every((a) => a === "nenhum");

  return (
    <div className="mt-6 grid gap-3">
      {impedimento && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{impedimento}</p>}

      {!impedimento && (
        <fieldset className="grid gap-2">
          <legend className="mb-1 text-sm font-semibold">O que o assistente pode fazer</legend>
          {NIVEIS.map((n) => (
            <label key={n.id} className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${nivel === n.id ? "border-neutral-900 bg-neutral-50" : "border-neutral-200"}`}>
              <input type="radio" name="nivel" className="mt-1" checked={nivel === n.id} onChange={() => setNivel(n.id)} />
              <span>
                <strong className="block">{n.nome}</strong>
                <span className="text-neutral-600">{n.descricao}</span>
              </span>
            </label>
          ))}

          {nivel === "areas" && (
            <div className="grid gap-2 rounded-lg border border-neutral-200 p-3">
              {AREAS.map((a) => (
                <label key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="min-w-0">
                    <strong className="block">{a.nome}</strong>
                    <span className="text-xs text-neutral-600">{a.descricao}</span>
                  </span>
                  <select
                    className="h-9 rounded-md border border-neutral-300 bg-white px-2 text-sm"
                    value={areas[a.id]}
                    onChange={(e) => setAreas((atual) => ({ ...atual, [a.id]: e.target.value as AcessoDaArea }))}
                  >
                    <option value="nenhum">Sem acesso</option>
                    <option value="ler">Consultar</option>
                    {a.escrever && <option value="alterar">Consultar e alterar</option>}
                  </select>
                </label>
              ))}
            </div>
          )}
        </fieldset>
      )}

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
