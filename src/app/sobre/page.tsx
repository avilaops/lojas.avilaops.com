import type { Metadata } from "next";
import { exigirTenant } from "@/lib/tenant";

export const metadata: Metadata = { title: "Sobre" };

export default async function Sobre() {
  const t = await exigirTenant();
  return (
    <div className="container-loja max-w-2xl py-10">
      <h1 className="text-2xl font-bold">Sobre a {t.nome}</h1>
      <div className="prosa mt-4 text-sm leading-relaxed">
        {(t.sobre ?? `A ${t.nome} atende pela internet e, quando disponível, no balcão.`).split(/\n{2,}/).map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  );
}
