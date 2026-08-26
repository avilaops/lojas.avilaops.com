"use client";

import { useEffect } from "react";
import { comprar, type ItemEvento } from "@/lib/eventos-loja";

/**
 * Dispara o evento de compra na página do pedido, uma vez por pedido (o
 * controle está em eventos-loja.ts, via sessionStorage). Só entra na árvore
 * quando o pedido já foi pago — pedido aguardando PIX não é venda.
 */
export default function EventoCompra({ itens, totalCentavos, freteCentavos, referencia, googleAdsId, rotuloCompra }: { itens: ItemEvento[]; totalCentavos: number; freteCentavos: number; referencia: string; googleAdsId: string | null; rotuloCompra: string | null }) {
  useEffect(() => {
    comprar(itens, { totalCentavos, freteCentavos, referencia, googleAdsId, rotuloCompra });
  }, [itens, totalCentavos, freteCentavos, referencia, googleAdsId, rotuloCompra]);
  return null;
}
