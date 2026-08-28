import { notFound } from "next/navigation";
import { exigirTenant, lojaVende } from "@/lib/tenant";
import { listarProdutos } from "@/lib/catalogo";
import { prisma } from "@/lib/db";
import ProductCard from "@/components/ProductCard";
import { minhaMoto } from "@/lib/minha-moto";
import { nomeDaMoto } from "@/lib/motos";
import Link from "next/link";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props) {
  const t = await exigirTenant();
  const { slug } = await params;
  const c = await prisma.categoria.findUnique({ where: { tenantId_slug: { tenantId: t.id, slug } } });
  return { title: c?.nome ?? "Categoria", description: c?.descricao ?? undefined };
}

export default async function Categoria({ params }: Props) {
  const t = await exigirTenant();
  const { slug } = await params;
  const categoria = await prisma.categoria.findUnique({ where: { tenantId_slug: { tenantId: t.id, slug } } });
  if (!categoria) notFound();
  const moto = t.segmento === "motopecas" ? await minhaMoto() : null;
  const produtos = await listarProdutos(t.id, { categoriaSlug: slug, moto });
  return (
    <div className="container-loja py-8">
      <h1 className="mb-1 text-2xl font-bold">{categoria.nome}</h1>
      {categoria.descricao && <p className="mb-2 max-w-2xl text-sm text-muted-foreground">{categoria.descricao}</p>}
      <p className="mb-6 text-sm text-muted-foreground">
        {moto ? <>Mostrando o que serve na {nomeDaMoto(moto)} · <Link href={`/produtos?categoria=${categoria.slug}&moto=todas`} className="underline">ver tudo desta categoria</Link></> : <>{produtos.length} item(ns)</>}
      </p>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {produtos.map((p) => (
          <ProductCard key={p.id} produto={p} vende={lojaVende(t)} whatsapp={t.whatsapp} moto={moto} />
        ))}
      </div>
    </div>
  );
}
