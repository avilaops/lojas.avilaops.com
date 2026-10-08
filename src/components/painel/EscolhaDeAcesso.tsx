"use client";

import { AREAS, type AcessoDaArea, type EscolhaDeAcesso as Escolha, type NivelDeAcesso } from "@/lib/mcp-permissoes";

const NIVEIS: { id: NivelDeAcesso; nome: string; descricao: string }[] = [
  { id: "completo", nome: "Consultar e alterar", descricao: "Lê e altera a loja: produtos, preços, estoque, pedidos e cupons." },
  { id: "leitura", nome: "Só consultar", descricao: "Lê tudo e não altera nada. Bom para relatórios e para tirar dúvidas." },
  { id: "areas", nome: "Escolher por área", descricao: "Você decide o que ele vê e o que ele altera." },
];

/** `true` quando a escolha por área não marcou nada: não há o que autorizar. */
export function escolhaVazia(e: Escolha): boolean {
  return e.nivel === "areas" && Object.values(e.areas).every((a) => a === "nenhum");
}

/**
 * O que um assistente pode fazer na loja: os três níveis e, no terceiro, a
 * lista de áreas. A mesma peça na tela de autorização e no painel, para o
 * lojista escolher com as mesmas palavras ao conectar e ao mudar depois.
 *
 * Só desenha e devolve a escolha; quem a transforma em escopos é
 * `escoposDaAutorizacao`, no servidor.
 */
export default function EscolhaDeAcesso({ nome, valor, aoMudar }: { nome: string; valor: Escolha; aoMudar: (e: Escolha) => void }) {
  return (
    <fieldset className="grid gap-2">
      <legend className="mb-1 text-sm font-semibold">O que o assistente pode fazer</legend>
      {NIVEIS.map((n) => (
        <label
          key={n.id}
          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm ${valor.nivel === n.id ? "border-foreground bg-muted" : "border-border"}`}
        >
          <input type="radio" name={nome} className="mt-1" checked={valor.nivel === n.id} onChange={() => aoMudar({ ...valor, nivel: n.id })} />
          <span>
            <strong className="block">{n.nome}</strong>
            <span className="text-muted-foreground">{n.descricao}</span>
          </span>
        </label>
      ))}

      {valor.nivel === "areas" && (
        <div className="grid gap-2 rounded-lg border border-border p-3">
          {AREAS.map((a) => (
            <label key={a.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="min-w-0">
                <strong className="block">{a.nome}</strong>
                <span className="text-xs text-muted-foreground">{a.descricao}</span>
              </span>
              <select
                className="h-9 w-44 rounded-md border border-border bg-background px-2 text-sm"
                value={valor.areas[a.id]}
                onChange={(e) => aoMudar({ ...valor, areas: { ...valor.areas, [a.id]: e.target.value as AcessoDaArea } })}
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
  );
}
