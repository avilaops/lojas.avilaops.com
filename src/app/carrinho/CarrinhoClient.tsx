"use client";

import Link from "next/link";
import { useState } from "react";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";
import { formatarBRL } from "@/lib/catalogo";
import type { TenantPublico } from "@/lib/tenant";
import { linkWhatsApp } from "@/components/WhatsAppFlutuante";
import Sugestoes from "@/components/cart/Sugestoes";

export default function CarrinhoClient({ loja, vende }: { loja: TenantPublico; vende: boolean }) {
  const { itens, subtotal, alterar, remover, pronto, cupom, aplicarCupom } = useCart();
  const [codigo, setCodigo] = useState("");
  const [erroCupom, setErroCupom] = useState<string | null>(null);
  const [aplicando, setAplicando] = useState(false);

  async function aplicar() {
    setErroCupom(null);
    setAplicando(true);
    try {
      const r = await fetch("/api/cupom", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ codigo, itens: itens.map((i) => ({ id: i.id, quantidade: i.quantidade })) }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.erro ?? "Cupom inválido.");
      aplicarCupom({ codigo: d.codigo, tipo: d.tipo, desconto: d.desconto });
      setCodigo("");
    } catch (e) {
      setErroCupom(e instanceof Error ? e.message : "Cupom inválido.");
    } finally {
      setAplicando(false);
    }
  }

  if (!pronto) return <div className="container-loja py-12 text-sm text-muted-foreground">Carregando…</div>;

  if (itens.length === 0) {
    return (
      <div className="container-loja py-16 text-center">
        <h1 className="text-xl font-bold">Seu carrinho está vazio</h1>
        <Link href="/produtos" className="btn-primario mt-6">
          Ver produtos
        </Link>
      </div>
    );
  }

  const resumo = itens.map((i) => `${i.quantidade}x ${i.nome}`).join("\n");

  // Barra de frete grátis: mostra o quanto falta em vez de só anunciar o valor
  // na vitrine. O cupom de frete grátis já resolve sozinho, então some.
  const alvoFrete = loja.freteGratisAcima;
  const freteGratisPorCupom = cupom?.tipo === "FRETE_GRATIS";
  const faltamParaFrete = alvoFrete != null ? alvoFrete - subtotal : null;

  return (
    <div className="container-loja grid min-w-0 gap-8 py-8 md:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0">
        <h1 className="mb-4 text-2xl font-bold">Carrinho</h1>
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {itens.map((i) => (
            <li key={i.id} className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-3 p-3 sm:flex">
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted sm:h-16 sm:w-16">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {i.imagem && <img src={i.imagem} alt="" className="h-full w-full object-contain" />}
              </div>
              <div className="min-w-0 flex-1">
                <Link href={`/produtos/${i.slug}`} className="line-clamp-2 text-sm font-semibold">
                  {i.nome}
                </Link>
                <p className="text-xs text-muted-foreground">{formatarBRL(i.precoCentavos)} cada</p>
              </div>
              <div className="col-start-2 row-start-2 flex shrink-0 items-center justify-self-start gap-1 rounded-lg border border-border">
                <button aria-label="Menos" className="p-2" onClick={() => alterar(i.id, i.quantidade - 1)}>
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="w-6 text-center text-sm">{i.quantidade}</span>
                <button aria-label="Mais" className="p-2" onClick={() => alterar(i.id, i.quantidade + 1)}>
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="col-start-3 row-start-2 whitespace-nowrap text-right text-sm font-bold sm:w-24">{formatarBRL(i.precoCentavos * i.quantidade)}</p>
              <button aria-label="Remover" className="col-start-3 row-start-1 p-2 text-muted-foreground hover:text-foreground" onClick={() => remover(i.id)}>
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
        <Sugestoes />
      </div>

      <aside className="h-fit min-w-0 rounded-xl border border-border bg-card p-4">
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span className="font-bold">{formatarBRL(subtotal)}</span>
        </div>
        {cupom && (
          <div className="mt-1 flex justify-between text-sm text-emerald-700">
            <span>Cupom {cupom.codigo}{cupom.tipo === "FRETE_GRATIS" ? " · frete grátis" : ""}</span>
            <span>{cupom.desconto > 0 ? `− ${formatarBRL(cupom.desconto)}` : ""}<button className="ml-2 text-xs underline" onClick={() => aplicarCupom(null)}>remover</button></span>
          </div>
        )}
        {!cupom && vende && (
          <div className="mt-3 flex gap-2">
            <input aria-label="Código do cupom" className="h-10 min-w-0 flex-1 rounded-lg border border-border bg-background px-3 text-sm uppercase" placeholder="Cupom" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
            <button className="btn-secundario h-10 shrink-0 px-3 text-xs" disabled={aplicando || !codigo.trim()} onClick={aplicar}>Aplicar</button>
          </div>
        )}
        {erroCupom && <p className="mt-1 text-xs text-red-700">{erroCupom}</p>}
        {alvoFrete != null && !freteGratisPorCupom && (
          <div className="mt-3">
            <p className="text-xs font-medium">
              {faltamParaFrete! > 0 ? <>Faltam <b>{formatarBRL(faltamParaFrete!)}</b> para o frete grátis</> : <span className="text-emerald-700">Você garantiu o frete grátis</span>}
            </p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-emerald-600 transition-all" style={{ width: `${Math.min((subtotal / alvoFrete) * 100, 100)}%` }} />
            </div>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">Frete calculado no próximo passo.</p>
        {vende ? (
          <Link href="/checkout" className="btn-primario mt-4 w-full">
            Finalizar compra
          </Link>
        ) : loja.whatsapp ? (
          <a href={linkWhatsApp(loja.whatsapp, `Olá! Quero fazer um pedido:\n${resumo}`)} target="_blank" rel="noopener" className="btn-primario mt-4 w-full">
            Pedir pelo WhatsApp
          </a>
        ) : null}
        <Link href="/produtos" className="btn-secundario mt-2 w-full">
          Continuar comprando
        </Link>
      </aside>
    </div>
  );
}
