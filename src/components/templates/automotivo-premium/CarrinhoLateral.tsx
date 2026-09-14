"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "@/components/cart/CartProvider";

const reais = (centavos: number) => (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function CarrinhoLateral() {
  const { aberto, fechar, itens, subtotal, alterar, remover } = useCart();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!aberto) { ref.current?.close(); return; }
    ref.current?.showModal();
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = anterior; };
  }, [aberto]);
  return <dialog ref={ref} className="ap-dialog ap-cart-dialog" aria-labelledby="ap-cart-titulo" onClose={fechar} onClick={e => { if (e.target === e.currentTarget) fechar(); }}>
    <div className="ap-cart-conteudo"><div className="ap-dialog-topo"><h2 id="ap-cart-titulo">Seu carrinho</h2><button className="ap-icone" onClick={fechar} aria-label="Fechar carrinho"><X size={22}/></button></div>
    {itens.length === 0 ? <div className="ap-cart-vazio"><ShoppingBag size={48}/><h3>O próximo cuidado começa aqui.</h3><p>Escolha seus produtos e monte a sua rotina.</p><Link href="/produtos" className="btn-primario" onClick={fechar}>Explorar produtos <ArrowRight size={16}/></Link></div> : <>
      <ul className="ap-cart-itens">{itens.map(i => <li key={i.id}>
        <Link href={`/produtos/${i.slug}`} onClick={fechar} className="ap-cart-foto">{i.imagem && <Image unoptimized src={i.imagem} alt="" width={86} height={86}/>}</Link>
        <div><Link href={`/produtos/${i.slug}`} onClick={fechar}>{i.nome}</Link><span>{reais(i.precoCentavos)}</span><div className="ap-quantidade"><button onClick={() => alterar(i.id, i.quantidade - 1)} aria-label={`Diminuir quantidade de ${i.nome}`}><Minus size={15}/></button><output aria-label={`Quantidade de ${i.nome}`}>{i.quantidade}</output><button onClick={() => alterar(i.id, i.quantidade + 1)} aria-label={`Aumentar quantidade de ${i.nome}`}><Plus size={15}/></button></div></div>
        <button className="ap-remover" onClick={() => remover(i.id)} aria-label={`Remover ${i.nome}`}><Trash2 size={16}/></button>
      </li>)}</ul><div className="ap-cart-resumo"><p><span>Subtotal estimado</span><strong>{reais(subtotal)}</strong></p><small>Preço e disponibilidade confirmados no checkout. Frete calculado pelo CEP.</small><Link href="/checkout" className="btn-primario" onClick={fechar}>Finalizar compra <ArrowRight size={17}/></Link><Link href="/carrinho" className="ap-link" onClick={fechar}>Revisar carrinho ou usar cupom</Link><button className="ap-link" onClick={fechar}>Continuar comprando</button></div>
    </>}
    </div>
  </dialog>;
}
