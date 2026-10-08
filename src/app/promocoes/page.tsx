import type { Metadata } from "next";
import Link from "next/link";
import ProductCard from "@/components/ProductCard";
import BannerCarousel from "@/components/home/BannerCarousel";
import { prisma } from "@/lib/db";
import { exigirTenant, lojaVende, temaDo } from "@/lib/tenant";
import { campanhasDaLoja } from "@/lib/campanhas";
import { whereEmPromocao } from "@/lib/promocoes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Promoções e campanhas",
  description: "Campanhas e ofertas ativas da loja.",
  alternates: { canonical: "/promocoes" },
};

export default async function Promocoes() {
  const t = await exigirTenant();
  const campanhas = campanhasDaLoja(temaDo(t))
    .map((campanha) => ({ imagemUrl: campanha.imagemUrl, imagemMobileUrl: campanha.imagemMobileUrl, link: campanha.link, alt: campanha.alt }));
  const produtos = await prisma.produto.findMany({
    where: whereEmPromocao(t.id),
    include: { categoria: true },
    orderBy: [{ destaque: "desc" }, { atualizadoEm: "desc" }],
    take: 48,
  });

  return (
    <div className="home-campanhas py-6" aria-label="Promoções e campanhas">
      <header className="container-loja mb-6">
        <h1 className="text-3xl font-bold">Promoções e campanhas</h1>
        <p className="mt-2 text-muted-foreground">Confira as ofertas disponíveis na loja.</p>
      </header>
      {produtos.length === 0 && (
        <section className="container-loja py-10" aria-labelledby="sem-promocoes">
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <h2 id="sem-promocoes" className="text-xl font-semibold">Nenhum produto com desconto ativo no momento</h2>
            <p className="mx-auto mt-3 max-w-lg text-muted-foreground">Nosso catálogo continua disponível. Explore os produtos e encontre o que você precisa.</p>
            <Link href="/produtos" className="btn-primario mt-6 inline-flex">Explorar produtos</Link>
          </div>
        </section>
      )}
      {campanhas.length > 0 && <BannerCarousel campanhas={campanhas} />}
      {produtos.length > 0 && (
        <section className="container-loja campanhas-produtos" aria-label="Ofertas com desconto ativo">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {produtos.map((produto) => <ProductCard loja={t} key={produto.id} produto={produto} vende={lojaVende(t)} whatsapp={t.whatsapp} />)}
          </div>
        </section>
      )}
    </div>
  );
}
