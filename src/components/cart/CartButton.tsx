"use client";

import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { useCart } from "./CartProvider";

export default function CartButton() {
  const { quantidade } = useCart();
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
