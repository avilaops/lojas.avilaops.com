"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Search, X } from "lucide-react";
import { buscarAtalhosDoPainel } from "@/lib/navegacao-painel";

export const EVENTO_BUSCA = "painel:buscar";
export function abrirBusca() { window.dispatchEvent(new Event(EVENTO_BUSCA)); }

type Achado = { chave: string; grupo: string; titulo: string; apoio?: string; href: string };
type RespostaBusca = {
  produtos?: Array<{ id: string; nome: string; sku: string | null; ativo: boolean; precoCentavos: number }>;
  pedidos?: Array<{ id: string; numero: number; clienteNome: string; status: string; totalCentavos: number }>;
};
const brl = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const PEDIDO: Record<string, string> = { AGUARDANDO_PAGAMENTO: "aguardando pagamento", PAGO: "pago", EM_SEPARACAO: "em separação", ENVIADO: "enviado", ENTREGUE: "entregue", CANCELADO: "cancelado", ESTORNADO: "estornado" };

export default function BuscaPainel({ pixManual = false, configuradorSobMedida = false }: { pixManual?: boolean; configuradorSobMedida?: boolean }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [achados, setAchados] = useState<Achado[]>([]);
  const [ativo, setAtivo] = useState(0);
  const [buscando, setBuscando] = useState(false);
  const [recado, setRecado] = useState("");
  const [sessaoExpirada, setSessaoExpirada] = useState(false);
  const campo = useRef<HTMLInputElement>(null);
  const dialogo = useRef<HTMLDialogElement>(null);
  const lista = useRef<HTMLDivElement>(null);

  function fechar() { setAberto(false); }

  useEffect(() => {
    const aoTeclar = (evento: KeyboardEvent) => {
      if ((evento.metaKey || evento.ctrlKey) && evento.key.toLowerCase() === "k") {
        evento.preventDefault();
        setAberto((valor) => !valor);
        setTermo("");
        setAtivo(0);
        setAchados([]);
        setRecado("");
        setSessaoExpirada(false);
      }
    };
    const aoPedir = () => { setTermo(""); setAtivo(0); setAchados([]); setRecado(""); setSessaoExpirada(false); setAberto(true); };
    document.addEventListener("keydown", aoTeclar);
    window.addEventListener(EVENTO_BUSCA, aoPedir);
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      window.removeEventListener(EVENTO_BUSCA, aoPedir);
    };
  }, []);

  useEffect(() => {
    if (!aberto) return;
    const elemento = dialogo.current;
    const anterior = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const overflow = document.body.style.overflow;
    if (elemento && !elemento.open) elemento.showModal();
    document.body.style.overflow = "hidden";
    campo.current?.focus();
    return () => {
      elemento?.close();
      document.body.style.overflow = overflow;
      if (anterior?.isConnected) anterior.focus();
    };
  }, [aberto]);

  useEffect(() => {
    if (!aberto) return;
    const consulta = termo.trim();
    const secoes: Achado[] = buscarAtalhosDoPainel(consulta, { pixManual, configuradorSobMedida })
      .map((secao) => ({ chave: `s:${secao.href}`, grupo: "Ir para", titulo: secao.rotulo, href: secao.href }));
    setAchados(secoes);
    setAtivo(0);
    setRecado("");
    setSessaoExpirada(false);
    setBuscando(consulta.length >= 2);
    if (consulta.length < 2) return;

    const controller = new AbortController();
    let vigente = true;
    const timer = setTimeout(async () => {
      try {
        const resposta = await fetch(`/api/painel/busca?q=${encodeURIComponent(consulta)}`, { signal: controller.signal, cache: "no-store" });
        if (!vigente) return;
        if (resposta.status === 401) {
          setSessaoExpirada(true);
          setRecado("Sua sessão expirou. Entre novamente para buscar produtos e pedidos.");
          return;
        }
        if (!resposta.ok) throw new Error("Busca indisponível");
        const dados = await resposta.json() as RespostaBusca;
        if (!vigente) return;
        setAchados([
          ...(dados.pedidos ?? []).map((pedido) => ({
            chave: `pe:${pedido.id}`, grupo: "Pedidos", titulo: `#${pedido.numero} · ${pedido.clienteNome}`,
            apoio: `${brl(pedido.totalCentavos)} · ${PEDIDO[pedido.status] ?? pedido.status}`,
            href: `/painel/pedidos/${encodeURIComponent(pedido.id)}`,
          })),
          ...(dados.produtos ?? []).map((produto) => ({
            chave: `pr:${produto.id}`, grupo: "Produtos", titulo: produto.nome,
            apoio: `${brl(produto.precoCentavos)}${produto.sku ? ` · ${produto.sku}` : ""}${produto.ativo ? "" : " · inativo"}`,
            href: `/painel/produtos/${encodeURIComponent(produto.id)}`,
          })),
          ...secoes,
        ]);
        setAtivo(0);
      } catch {
        if (vigente) setRecado("Não foi possível buscar produtos e pedidos. Os atalhos do painel continuam disponíveis.");
      } finally {
        if (vigente) setBuscando(false);
      }
    }, 220);
    return () => { vigente = false; controller.abort(); clearTimeout(timer); };
  }, [aberto, termo, pixManual, configuradorSobMedida]);

  useEffect(() => {
    if (aberto) lista.current?.querySelector<HTMLElement>(`#pbusca-opcao-${ativo}`)?.scrollIntoView({ block: "nearest" });
  }, [aberto, ativo, achados]);

  function abrir(achado: Achado | undefined) {
    if (!achado) return;
    fechar();
    router.push(achado.href);
  }

  if (!aberto) return null;
  return <dialog ref={dialogo} className="pbusca" aria-label="Buscar no painel" aria-describedby="pbusca-instrucoes"
    onCancel={(evento) => { evento.preventDefault(); fechar(); }}>
    <button type="button" className="pbusca-fundo" tabIndex={-1} aria-label="Fechar busca" onClick={fechar} />
    <div className="pbusca-caixa">
      <div className="pbusca-campo">
        {buscando ? <LoaderCircle size={18} className="pbusca-carregando" aria-hidden="true" /> : <Search size={18} aria-hidden="true" />}
        <label htmlFor="pbusca-termo" className="sr-only">Buscar pedido, produto ou seção</label>
        <input ref={campo} id="pbusca-termo" value={termo} autoComplete="off" role="combobox" aria-expanded="true" aria-autocomplete="list"
          aria-controls="pbusca-resultados" aria-activedescendant={achados[ativo] ? `pbusca-opcao-${ativo}` : undefined}
          placeholder="Pedido, produto ou seção" onChange={(evento) => { setTermo(evento.target.value); setAtivo(0); }}
          onKeyDown={(evento) => {
            if (evento.key === "ArrowDown") { evento.preventDefault(); setAtivo((indice) => Math.max(0, Math.min(indice + 1, achados.length - 1))); }
            if (evento.key === "ArrowUp") { evento.preventDefault(); setAtivo((indice) => Math.max(indice - 1, 0)); }
            if (evento.key === "Enter") { evento.preventDefault(); abrir(achados[ativo]); }
          }} />
        <button type="button" className="pbusca-fechar" onClick={fechar} aria-label="Fechar busca"><X size={18} aria-hidden="true" /></button>
      </div>
      <p className="pbusca-estado" role="status" aria-live="polite">{buscando ? "Buscando produtos e pedidos…" : recado || `${achados.length} ${achados.length === 1 ? "resultado disponível" : "resultados disponíveis"}`}</p>
      {sessaoExpirada && <a href="/entrar" className="pbusca-entrar">Entrar novamente</a>}
      {achados.length === 0 && !buscando && <p className="pbusca-vazio">Nenhum resultado. Tente outro nome, SKU ou número de pedido.</p>}
      <div ref={lista} id="pbusca-resultados" className="pbusca-lista" role="listbox" aria-label="Resultados da busca" aria-busy={buscando}>
        {achados.map((achado, indice) => {
          const cabecalho = indice === 0 || achado.grupo !== achados[indice - 1].grupo;
          return <div key={achado.chave} role="presentation">
            {cabecalho && <p className="pbusca-grupo" aria-hidden="true">{achado.grupo}</p>}
            <button type="button" id={`pbusca-opcao-${indice}`} role="option" aria-selected={indice === ativo}
              aria-label={`${achado.grupo}: ${achado.titulo}${achado.apoio ? `, ${achado.apoio}` : ""}`}
              tabIndex={-1} className={`pbusca-item${indice === ativo ? " pbusca-item-ativo" : ""}`}
              onMouseEnter={() => setAtivo(indice)} onClick={() => abrir(achado)}>
              <span>{achado.titulo}</span>{achado.apoio && <small>{achado.apoio}</small>}
            </button>
          </div>;
        })}
      </div>
      <footer className="pbusca-instrucoes" id="pbusca-instrucoes"><span>↑ ↓ navegar</span><span>Enter abrir</span><span>Esc fechar</span></footer>
    </div>
  </dialog>;
}
