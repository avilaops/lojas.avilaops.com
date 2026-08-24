import type { Metadata } from "next";
import { exigirTenant, lojaVende } from "@/lib/tenant";
import { listarProdutos } from "@/lib/catalogo";
import ProductCard from "@/components/ProductCard";

export const metadata: Metadata = { title: "Produtos" };

export default async function Produtos({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const t = await exigirTenant();
  const { q } = await searchParams;
  const produtos = await listarProdutos(t.id, { busca: q?.trim() || undefined });
  return (
    <div className="container-loja py-8">
      <h1 className="mb-1 text-2xl font-bold">{q ? `Resultados para “${q}”` : "Todos os produtos"}</h1>
      <p className="mb-6 text-sm text-muted-foreground">{produtos.length} item(ns)</p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {produtos.map((p) => (
          <ProductCard key={p.id} produto={p} vende={lojaVende(t)} whatsapp={t.whatsapp} />
        ))}
      </div>
    </div>
  );
}
