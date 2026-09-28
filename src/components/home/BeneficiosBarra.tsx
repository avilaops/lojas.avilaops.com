import { BadgeCheck, PackageCheck, Store, Truck } from "lucide-react";
import type { Tenant } from "@prisma/client";
import { retiradaPublicaDisponivel } from "@/lib/tenant";

export default function BeneficiosBarra({ t }: { t: Tenant }) {
  const itens = [
    {
      Icone: PackageCheck,
      titulo: `Despacho em até ${t.despachoDiasUteis} ${t.despachoDiasUteis === 1 ? "dia útil" : "dias úteis"}`,
      texto: "Prazo informado antes da compra",
    },
    t.freteGratisAcima != null
      ? {
          Icone: Truck,
          titulo: `Frete grátis acima de R$ ${(t.freteGratisAcima / 100).toFixed(0)}`,
          texto: "Benefício calculado no carrinho",
        }
      : {
          Icone: Truck,
          titulo: "Frete calculado pelo CEP",
          texto: "Opções e prazo antes do pagamento",
        },
    retiradaPublicaDisponivel(t)
      ? { Icone: Store, titulo: "Retirada disponível", texto: "Economize no frete quando preferir" }
      : { Icone: BadgeCheck, titulo: "Pedido acompanhado", texto: "Status da compra em um só lugar" },
  ];

  return (
    <aside className="beneficios-barra" aria-label="Vantagens da loja">
      {itens.map(({ Icone, titulo, texto }) => (
        <div key={titulo}>
          <Icone aria-hidden="true" />
          <p><strong>{titulo}</strong><span>{texto}</span></p>
        </div>
      ))}
    </aside>
  );
}
