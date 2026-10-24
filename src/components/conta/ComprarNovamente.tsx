"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/components/cart/CartProvider";
import type { RevisaoRecompra } from "@/lib/recompra";

const moeda = (valor: number) => (valor / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function ComprarNovamente({ pedidoId }: { pedidoId: string }) {
  const { adicionar, pronto, itens: carrinho } = useCart();
  const router = useRouter();
  const tituloId = useId();
  const [revisao, setRevisao] = useState<RevisaoRecompra | null>(null);
  const [selecionados, setSelecionados] = useState<string[]>([]);
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const [adicionado, setAdicionado] = useState(false);

  async function carregar() {
    setOcupado(true);
    setErro("");
    try {
      const resposta = await fetch(`/api/conta/pedidos/${encodeURIComponent(pedidoId)}/recompra`, { cache: "no-store" });
      const dados = await resposta.json().catch(() => null);
      if (!resposta.ok || !dados) throw new Error(dados?.erro ?? "Não foi possível consultar os produtos.");
      const atual: RevisaoRecompra = dados;
      setRevisao(atual);
      setSelecionados(atual.itens.filter(i => i.oferta).map(i => i.linhaId));
      setAdicionado(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível consultar os produtos.");
    } finally { setOcupado(false); }
  }

  const escolhidos = revisao?.itens.filter(i => i.oferta && selecionados.includes(i.linhaId)) ?? [];
  const subtotal = escolhidos.reduce((s, i) => s + i.oferta!.precoCentavos * i.quantidade, 0);

  return <div className="w-full">
    {!revisao && <button type="button" className="btn-secundario h-9 px-3 text-xs" disabled={ocupado || !pronto} onClick={carregar}>{ocupado ? "Consultando produtos…" : "Comprar novamente"}</button>}
    {erro && <p role="alert" className="mt-2 text-sm text-destructive">{erro}</p>}
    {revisao && <section aria-labelledby={tituloId} className="mt-2 rounded-xl border border-border bg-background p-4">
      <h3 id={tituloId} className="font-semibold">Revise a recompra do pedido #{revisao.numero}</h3>
      <p className="mt-1 text-xs text-muted-foreground">Preços e disponibilidade consultados agora. As quantidades serão somadas ao seu carrinho. Frete, descontos e disponibilidade serão conferidos novamente no checkout.</p>
      <ul className="my-3 divide-y divide-border">
        {revisao.itens.map(item => <li key={item.linhaId} className="py-3">
          <label className="flex items-start gap-3">
            <input type="checkbox" className="mt-1 h-4 w-4 shrink-0" disabled={!item.oferta || adicionado} checked={selecionados.includes(item.linhaId)} onChange={e => setSelecionados(a => e.target.checked ? [...a, item.linhaId] : a.filter(id => id !== item.linhaId))} />
            <span className="min-w-0 text-sm"><span className="block font-medium">{item.quantidade}× {item.oferta?.nome ?? item.nomeAnterior}</span>
              {item.oferta ? <span className="text-xs text-muted-foreground">Agora {moeda(item.oferta.precoCentavos)} por unidade{item.precoAnteriorCentavos !== item.oferta.precoCentavos && <> · No pedido anterior: {moeda(item.precoAnteriorCentavos)}</>}</span> : <span className="text-xs text-muted-foreground">{item.motivo}</span>}
            </span>
          </label>
        </li>)}
      </ul>
      <p className="mb-3 text-sm font-semibold">Subtotal selecionado: {moeda(subtotal)} <span className="font-normal text-muted-foreground">· sem frete</span></p>
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn-primario text-sm" disabled={!pronto || !escolhidos.length || adicionado} onClick={() => {
          if (adicionado) return;
          const quantidades = new Map(carrinho.map(i => [i.id, i.quantidade]));
          for (const item of escolhidos) quantidades.set(item.oferta!.id, (quantidades.get(item.oferta!.id) ?? 0) + item.quantidade);
          if (quantidades.size > 50 || [...quantidades.values()].some(q => q > 999)) {
            setErro("A seleção ultrapassa o limite de 50 produtos ou 999 unidades por produto no carrinho. Selecione menos itens ou revise seu carrinho.");
            return;
          }
          for (const item of escolhidos) adicionar(item.oferta!, item.quantidade);
          setAdicionado(true);
          router.push("/carrinho");
        }}>{adicionado ? "Adicionado" : "Adicionar selecionados ao carrinho"}</button>
        <button type="button" className="btn-secundario text-sm" onClick={() => { setRevisao(null); setErro(""); }}>Fechar revisão</button>
      </div>
    </section>}
  </div>;
}
