import type { Metadata } from "next";
import ProductCard from "@/components/ProductCard";
import BannerCarousel from "@/components/home/BannerCarousel";
import { prisma } from "@/lib/db";
import { exigirTenant, lojaVende, temaDo } from "@/lib/tenant";
import { campanhasDaLoja } from "@/lib/campanhas";
import { WHERE_COMPRAVEL } from "@/lib/produto-regras";

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
    where: {
      tenantId: t.id,
      ativo: true,
      precoCentavos: { gt: 0 },
      precoDeCentavos: { gt: prisma.produto.fields.precoCentavos },
      ...WHERE_COMPRAVEL,
      imagens: { isEmpty: false },
      imagemOrigem: "propria",
    },
    include: { categoria: true },
    orderBy: [{ destaque: "desc" }, { atualizadoEm: "desc" }],
    take: 48,
  });

  return (
    <main className="home-campanhas py-6" aria-label="Promoções e campanhas">
      {campanhas.length > 0 && <BannerCarousel campanhas={campanhas} />}
      {produtos.length > 0 && (
        <section className="container-loja campanhas-produtos" aria-label="Ofertas com desconto ativo">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {produtos.map((produto) => <ProductCard key={produto.id} produto={produto} vende={lojaVende(t)} whatsapp={t.whatsapp} />)}
          </div>
        </section>
      )}
    </main>
  );
}
