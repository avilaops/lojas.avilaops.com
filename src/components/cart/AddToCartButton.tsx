"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ShoppingBag } from "lucide-react";
import { useCart, type ItemLocal } from "./CartProvider";
import { adicionarAoCarrinho } from "@/lib/eventos-loja";

export default function AddToCartButton({ item, disponivel, irParaCarrinho = false, compacto = false }: { item: Omit<ItemLocal, "quantidade">; disponivel: boolean; irParaCarrinho?: boolean; compacto?: boolean }) {
  const { adicionar, painelHabilitado } = useCart();
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
      aria-label={ok ? `${item.nome} adicionado ao carrinho` : `Adicionar ${item.nome} ao carrinho`}
      onClick={() => {
        adicionar(item);
        adicionarAoCarrinho({ id: item.id, nome: item.nome, precoCentavos: item.precoCentavos });
        setOk(true);
        setTimeout(() => setOk(false), 1500);
        if (irParaCarrinho && !painelHabilitado) router.push("/carrinho");
      }}
    >
      {ok ? <Check className="h-4 w-4" /> : <ShoppingBag className="h-4 w-4" />}
      <span aria-live="polite">{ok ? "Adicionado" : compacto ? "Adicionar" : "Adicionar ao carrinho"}</span>
    </button>
  );
}
