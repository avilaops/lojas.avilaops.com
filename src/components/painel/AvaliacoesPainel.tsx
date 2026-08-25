"use client";

import { Secao } from "./campos";
import { Estrelas } from "@/components/Avaliacoes";

export interface AvaliacaoPainelView { id: string; produtoNome: string; nome: string; nota: number; texto: string | null; aprovada: boolean; criadoEm: string }

type Chamar = (c: string, m: string, b?: unknown, s?: string) => Promise<unknown>;

function Lista({ itens, titulo, chamar, ocupado }: { itens: AvaliacaoPainelView[]; titulo: string; chamar: Chamar; ocupado: boolean }) {
  return (
    <Secao titulo={titulo}>
      {itens.length === 0 ? <p className="text-sm text-muted-foreground">Nada aqui.</p> : (
        <ul className="divide-y divide-border text-sm">
          {itens.map((a) => (
            <li key={a.id} className="flex flex-wrap items-start gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><Estrelas nota={a.nota} /><span className="font-semibold">{a.nome}</span><span className="text-xs text-muted-foreground">{a.produtoNome} · {new Date(a.criadoEm).toLocaleDateString("pt-BR")}</span></div>
                {a.texto && <p className="mt-1">{a.texto}</p>}
              </div>
              <div className="flex gap-2 text-xs">
                <button className="btn-secundario h-8 px-3 text-xs" disabled={ocupado} onClick={() => chamar("/api/painel/avaliacoes", "PATCH", { id: a.id, aprovada: !a.aprovada }, a.aprovada ? "Avaliação ocultada." : "Avaliação publicada.")}>{a.aprovada ? "Ocultar" : "Publicar"}</button>
                <button className="text-muted-foreground underline" disabled={ocupado} onClick={() => confirm("Apagar esta avaliação?") && chamar(`/api/painel/avaliacoes?id=${a.id}`, "DELETE", undefined, "Avaliação apagada.")}>apagar</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Secao>
  );
}

export default function AvaliacoesPainel({ avaliacoes, chamar, ocupado }: { avaliacoes: AvaliacaoPainelView[]; chamar: Chamar; ocupado: boolean }) {
  const pendentes = avaliacoes.filter((a) => !a.aprovada);
  return (
    <>
      <Lista itens={pendentes} titulo={`Aguardando aprovação (${pendentes.length})`} chamar={chamar} ocupado={ocupado} />
      <Lista itens={avaliacoes.filter((a) => a.aprovada)} titulo="Publicadas" chamar={chamar} ocupado={ocupado} />
    </>
  );
}
