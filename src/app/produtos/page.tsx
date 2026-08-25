import type { Metadata } from "next";
import Link from "next/link";
import { exigirTenant, lojaVende } from "@/lib/tenant";
import { listarCategorias, listarProdutos, type OrdemCatalogo } from "@/lib/catalogo";
import ProductCard from "@/components/ProductCard";
import FiltrosProdutos from "@/components/FiltrosProdutos";

export const metadata: Metadata = { title: "Produtos" };

const ORDENS = new Set<OrdemCatalogo>(["relevancia", "menor-preco", "maior-preco", "recentes", "nome"]);
const reais = (v?: string) => {
  if (!v) return undefined;
  const n = Number.parseFloat(v.replace(/[^\d,.]/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : undefined;
};

export default async function Produtos({ searchParams }: { searchParams: Promise<{ q?: string; categoria?: string; ordem?: string; min?: string; max?: string }> }) {
  const t = await exigirTenant();
  const sp = await searchParams;
  const ordem = ORDENS.has(sp.ordem as OrdemCatalogo) ? (sp.ordem as OrdemCatalogo) : "relevancia";
  const [categorias, produtos] = await Promise.all([
    listarCategorias(t.id),
    listarProdutos(t.id, { busca: sp.q?.trim() || undefined, categoriaSlug: sp.categoria || undefined, ordem, minCentavos: reais(sp.min), maxCentavos: reais(sp.max) }),
  ]);
  const categoriaAtual = categorias.find((c) => c.slug === sp.categoria);

  return (
    <div className="container-loja py-8">
      <h1 className="mb-1 text-2xl font-bold">{sp.q ? `Resultados para “${sp.q}”` : categoriaAtual ? categoriaAtual.nome : "Todos os produtos"}</h1>
      <p className="mb-4 text-sm text-muted-foreground">{produtos.length} item(ns)</p>
      <FiltrosProdutos categorias={categorias} valores={sp} />
      {produtos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nada encontrado com esses filtros. <Link href="/produtos" className="underline">Limpar filtros</Link>
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {produtos.map((p) => (
            <ProductCard key={p.id} produto={p} vende={lojaVende(t)} whatsapp={t.whatsapp} />
          ))}
        </div>
      )}
    </div>
  );
}
