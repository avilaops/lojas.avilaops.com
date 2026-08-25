"use client";

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

/**
 * Carrinho no navegador.
 *
 * Diferente da Brilhax (carrinho no Medusa), aqui o carrinho é local: uma
 * lista de {id, quantidade} mais um retrato do produto para exibir. O preço
 * gravado aqui é só para a tela — no pagamento o servidor recalcula tudo pelo
 * catálogo (@avilaops/checkout/montarPedidoSeguro). Sem servidor de carrinho,
 * sem sessão, sem custo por loja.
 *
 * A chave inclui o slug: duas lojas no mesmo navegador não misturam carrinho.
 */
export interface ItemLocal {
  id: string;
  slug: string;
  nome: string;
  precoCentavos: number;
  imagem?: string;
  quantidade: number;
}

export interface CupomLocal { codigo: string; tipo: string; desconto: number }

interface CartValue {
  itens: ItemLocal[];
  quantidade: number;
  subtotal: number;
  cupom: CupomLocal | null;
  aplicarCupom: (c: CupomLocal | null) => void;
  adicionar: (item: Omit<ItemLocal, "quantidade">, quantidade?: number) => void;
  alterar: (id: string, quantidade: number) => void;
  remover: (id: string) => void;
  limpar: () => void;
  pronto: boolean;
}

const Ctx = createContext<CartValue | null>(null);

export function useCart() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useCart fora do CartProvider");
  return v;
}

export function CartProvider({ slug, children }: { slug: string; children: React.ReactNode }) {
  const chave = `loja:${slug}:carrinho`;
  const [itens, setItens] = useState<ItemLocal[]>([]);
  const [cupom, setCupom] = useState<CupomLocal | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    try {
      const salvo = window.localStorage.getItem(chave);
      if (salvo) setItens(JSON.parse(salvo));
      const c = window.localStorage.getItem(`${chave}:cupom`);
      if (c) setCupom(JSON.parse(c));
    } catch {
      /* storage bloqueado: carrinho vale a sessão */
    }
    setPronto(true);
  }, [chave]);

  useEffect(() => {
    if (!pronto) return;
    try {
      window.localStorage.setItem(chave, JSON.stringify(itens));
      if (cupom) window.localStorage.setItem(`${chave}:cupom`, JSON.stringify(cupom));
      else window.localStorage.removeItem(`${chave}:cupom`);
    } catch {
      /* idem */
    }
  }, [itens, cupom, chave, pronto]);

  const aplicarCupom = useCallback((c: CupomLocal | null) => setCupom(c), []);

  const adicionar = useCallback<CartValue["adicionar"]>((item, quantidade = 1) => {
    setItens((atual) => {
      const i = atual.findIndex((x) => x.id === item.id);
      if (i === -1) return [...atual, { ...item, quantidade }];
      const copia = [...atual];
      copia[i] = { ...copia[i], quantidade: copia[i].quantidade + quantidade };
      return copia;
    });
  }, []);

  const alterar = useCallback<CartValue["alterar"]>((id, quantidade) => {
    setItens((atual) => (quantidade <= 0 ? atual.filter((x) => x.id !== id) : atual.map((x) => (x.id === id ? { ...x, quantidade } : x))));
  }, []);

  const remover = useCallback((id: string) => setItens((a) => a.filter((x) => x.id !== id)), []);
  const limpar = useCallback(() => {
    setItens([]);
    setCupom(null);
  }, []);

  const value = useMemo<CartValue>(
    () => ({
      itens,
      quantidade: itens.reduce((s, i) => s + i.quantidade, 0),
      subtotal: itens.reduce((s, i) => s + i.precoCentavos * i.quantidade, 0),
      cupom,
      aplicarCupom,
      adicionar,
      alterar,
      remover,
      limpar,
      pronto,
    }),
    [itens, cupom, aplicarCupom, adicionar, alterar, remover, limpar, pronto],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
