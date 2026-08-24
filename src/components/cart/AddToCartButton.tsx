"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ShoppingBag } from "lucide-react";
import { useCart, type ItemLocal } from "./CartProvider";

export default function AddToCartButton({ item, disponivel, irParaCarrinho = false }: { item: Omit<ItemLocal, "quantidade">; disponivel: boolean; irParaCarrinho?: boolean }) {
  const { adicionar } = useCart();
  const router = useRouter();
  const [ok, setOk] = useState(false);

  if (!disponivel) {
    return (
      <button disabled className="btn-secundario w-full">
        Indisponível
      </button>
    );
  }

  return (
    <button
      className="btn-primario w-full"
      onClick={() => {
        adicionar(item);
        setOk(true);
        setTimeout(() => setOk(false), 1500);
        if (irParaCarrinho) router.push("/carrinho");
      }}
    >
      {ok ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
      {ok ? "Adicionado" : "Adicionar ao carrinho"}
    </button>
  );
}
