"use client";

import { useEffect } from "react";
import { verProduto, type ItemEvento } from "@/lib/eventos-loja";

/** view_item / ViewContent na página do produto. */
export default function EventoVerProduto({ item }: { item: ItemEvento }) {
  useEffect(() => {
    verProduto(item);
  }, [item]);
  return null;
}
