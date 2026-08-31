"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { SECOES } from "./NavPainel";

export const EVENTO_BUSCA = "painel:buscar";

/** Abre a busca de qualquer lugar do painel. */
export function abrirBusca() {
  window.dispatchEvent(new Event(EVENTO_BUSCA));
}

type Achado = { chave: string; grupo: string; titulo: string; apoio?: string; href: string };

const brl = (c: number) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const PEDIDO: Record<string, string> = {
  AGUARDANDO_PAGAMENTO: "aguardando pagamento",
  PAGO: "pago",
  EM_SEPARACAO: "em separação",
  ENVIADO: "enviado",
  ENTREGUE: "entregue",
  CANCELADO: "cancelado",
  ESTORNADO: "estornado",
};

/**
 * A busca do painel, no ⌘K.
 *
 * Com o menu lateral o lojista chega a qualquer seção em um clique, mas não a
 * um pedido ou a um produto específico: para achar "o pedido do Ronaldo" era
 * preciso abrir Pedidos e caçar na tabela. Aqui ele digita e vai direto.
 *
 * Sem seção só com o que já está na tela: as seções entram como resultado
 * porque quem usa ⌘K espera navegar por ele também.
 */
export default function BuscaPainel() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [achados, setAchados] = useState<Achado[]>([]);
  const [ativo, setAtivo] = useState(0);
  const campo = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAberto((a) => !a);
      }
      if (e.key === "Escape") setAberto(false);
    };
    // O botão "Buscar" mora no menu (lateral e barra do celular) e o diálogo
    // mora aqui, montado uma vez só: dois diálogos disputando o ⌘K abririam
    // duas caixas por cima uma da outra.
    const aoPedir = () => setAberto(true);
    document.addEventListener("keydown", aoTeclar);
    window.addEventListener(EVENTO_BUSCA, aoPedir);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      window.removeEventListener(EVENTO_BUSCA, aoPedir);
    };
  }, []);

  useEffect(() => {
    if (aberto) campo.current?.focus();
    else { setTermo(""); setAchados([]); setAtivo(0); }
  }, [aberto]);

  useEffect(() => {
    const t = termo.trim().toLowerCase();
    const secoes: Achado[] = SECOES
      .filter((s) => !t || s.rotulo.toLowerCase().includes(t))
      .map((s) => ({ chave: `s:${s.href}`, grupo: "Ir para", titulo: s.rotulo, href: s.href }));

    if (t.length < 2) { setAchados(secoes); setAtivo(0); return; }

    // Espera a digitação parar: um pedido por tecla derruba o banco à toa.
    const timer = setTimeout(async () => {
      try {
        const r = await fetch(`/api/painel/busca?q=${encodeURIComponent(termo.trim())}`);
        const d = (await r.json()) as {
          produtos?: Array<{ id: string; nome: string; sku: string | null; ativo: boolean; precoCentavos: number }>;
          pedidos?: Array<{ id: string; numero: number; clienteNome: string; status: string; totalCentavos: number }>;
        };
        setAchados([
          ...(d.pedidos ?? []).map((p) => ({
            chave: `pe:${p.id}`,
            grupo: "Pedidos",
            titulo: `#${p.numero} · ${p.clienteNome}`,
            apoio: `${brl(p.totalCentavos)} · ${PEDIDO[p.status] ?? p.status}`,
            href: `/painel/pedidos/${p.id}`,
          })),
          ...(d.produtos ?? []).map((p) => ({
            chave: `pr:${p.id}`,
            grupo: "Produtos",
            titulo: p.nome,
            apoio: `${brl(p.precoCentavos)}${p.sku ? ` · ${p.sku}` : ""}${p.ativo ? "" : " · inativo"}`,
            href: `/painel/produtos/${p.id}`,
          })),
          ...secoes,
        ]);
        setAtivo(0);
      } catch {
        setAchados(secoes);
      }
    }, 220);
    return () => clearTimeout(timer);
  }, [termo]);

  function abrir(a: Achado | undefined) {
    if (!a) return;
    setAberto(false);
    router.push(a.href);
  }

  if (!aberto) return null;

  let grupoAnterior = "";

  return (
    <div className="pbusca" role="dialog" aria-modal="true" aria-label="Buscar no painel">
      <button className="pbusca-fundo" aria-label="Fechar busca" onClick={() => setAberto(false)} />
      <div className="pbusca-caixa">
        <div className="pbusca-campo">
          <Search size={16} aria-hidden="true" />
          <input
            ref={campo}
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            placeholder="Pedido, produto ou seção"
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setAtivo((i) => Math.min(i + 1, achados.length - 1)); }
              if (e.key === "ArrowUp") { e.preventDefault(); setAtivo((i) => Math.max(i - 1, 0)); }
              if (e.key === "Enter") { e.preventDefault(); abrir(achados[ativo]); }
            }}
          />
        </div>
        <div className="pbusca-lista">
          {achados.length === 0 ? (
            <p className="pbusca-vazio">Nada com esse termo.</p>
          ) : (
            achados.map((a, i) => {
              const cabecalho = a.grupo !== grupoAnterior ? a.grupo : null;
              grupoAnterior = a.grupo;
              return (
                <div key={a.chave}>
                  {cabecalho && <p className="pbusca-grupo">{cabecalho}</p>}
                  <button
                    className={`pbusca-item${i === ativo ? " pbusca-item-ativo" : ""}`}
                    onMouseEnter={() => setAtivo(i)}
                    onClick={() => abrir(a)}
                  >
                    <span>{a.titulo}</span>
                    {a.apoio && <small>{a.apoio}</small>}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
