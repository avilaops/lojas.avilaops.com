"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ItemPixAConferir {
  referencia: string;
  numero: number | null;
  valorCentavos: number;
  informadoEm: string;
  expiraEm: string;
  temComprovante: boolean;
}

const brl = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const quando = (iso: string) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** A fila. O número do pedido e o valor identificam o Pix; o cliente não aparece aqui. */
export default function FilaPix({ itens }: { itens: ItemPixAConferir[] }) {
  const router = useRouter();
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function agir(referencia: string, acao: "confirmar" | "nao_recebido") {
    if (acao === "nao_recebido" && !window.confirm("O Pix não chegou? O pedido será cancelado e o estoque volta para a loja.")) return;
    setOcupado(`${acao}:${referencia}`);
    setErro(null);
    const r = await fetch("/api/painel/pix", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ referencia, acao }),
    });
    const corpo = (await r.json().catch(() => null)) as { mensagem?: string; erro?: string } | null;
    setOcupado(null);
    if (!r.ok) {
      setErro(corpo?.erro ?? "Não consegui registrar. Tente de novo.");
      return;
    }
    setAviso(corpo?.mensagem ?? "Registrado.");
    router.refresh();
  }

  if (itens.length === 0) {
    return <p className="text-sm text-muted-foreground">Nenhum Pix esperando conferência.</p>;
  }

  return (
    <div className="grid gap-3">
      {aviso && <p className="text-sm">{aviso}</p>}
      {erro && <p className="text-sm text-red-700">{erro}</p>}
      <ul className="divide-y divide-border rounded-xl border border-border bg-card">
        {itens.map((item) => (
          <li key={item.referencia} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <p className="font-medium">Pedido {item.numero != null ? `#${item.numero}` : ""}</p>
              <p className="text-sm">{brl(item.valorCentavos)}</p>
              <p className="text-xs text-muted-foreground">Avisou em {quando(item.informadoEm)}. Vale até {quando(item.expiraEm)}.</p>
              {item.temComprovante && (
                <a className="text-sm underline" href={`/api/painel/pix/${encodeURIComponent(item.referencia)}/comprovante`}>
                  Ver comprovante
                </a>
              )}
            </div>
            <div className="flex gap-2">
              <button type="button" className="btn-primario" disabled={ocupado !== null} onClick={() => void agir(item.referencia, "confirmar")}>
                Confirmar
              </button>
              <button type="button" className="btn-secundario" disabled={ocupado !== null} onClick={() => void agir(item.referencia, "nao_recebido")}>
                Não recebido
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
