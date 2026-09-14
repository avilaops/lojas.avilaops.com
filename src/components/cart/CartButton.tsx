"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./CartProvider";

export default function CartButton() {
  const { quantidade, painelHabilitado, abrir } = useCart();
  if (painelHabilitado) return <button type="button" className="ap-icone ap-cart-button" onClick={abrir} aria-label={`Abrir carrinho${quantidade ? `, ${quantidade} ${quantidade === 1 ? "item" : "itens"}` : ""}`}><ShoppingBag size={20}/>{quantidade > 0 && <span className="ap-cart-contador">{quantidade}</span>}</button>;
  return (
    <Link href="/carrinho" className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card" aria-label="Carrinho">
      <ShoppingBag className="h-5 w-5" />
      {quantidade > 0 && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
          {quantidade}
        </span>
      )}
    </Link>
  );
}
