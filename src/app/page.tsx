import { exigirTenant, identidadeDa, lojaVende, temaDo } from "@/lib/tenant";
import { listarCategorias, listarProdutos, provaSocialDa } from "@/lib/catalogo";
import Classico from "@/components/home/Classico";
import Vitrine from "@/components/home/Vitrine";
import Editorial from "@/components/home/Editorial";
import Minimal from "@/components/home/Minimal";
import ProvaSocial from "@/components/home/ProvaSocial";

/**
 * Página inicial: um de quatro layouts fixos (Tenant.tema.layout), todos
 * alimentados pelos mesmos dados. O lojista escolhe a composição; não
 * desenha. Ver src/lib/tema.ts (LAYOUTS).
 */
export default async function Home() {
  const t = await exigirTenant();
  const [categorias, destaques, prova] = await Promise.all([listarCategorias(t.id), listarProdutos(t.id, { destaque: true }), provaSocialDa(t.id)]);
  const vitrine = destaques.length ? destaques : await listarProdutos(t.id);
  const dados = { t, identidade: identidadeDa(t), categorias, vitrine, temDestaques: destaques.length > 0, vende: lojaVende(t) };

  const layout =
    temaDo(t).layout === "vitrine" ? <Vitrine {...dados} />
    : temaDo(t).layout === "editorial" ? <Editorial {...dados} />
    : temaDo(t).layout === "minimal" ? <Minimal {...dados} />
    : <Classico {...dados} />;

  return (
    <>
      {layout}
      <ProvaSocial dados={prova} nomeDaLoja={t.nome} />
      {prova.media !== null && prova.total >= 3 && (
        // A nota só entra no JSON-LD porque está visível na própria página,
        // que é o que o Google exige de dado estruturado de avaliação.
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "Store",
              name: t.nome,
              aggregateRating: { "@type": "AggregateRating", ratingValue: prova.media, reviewCount: prova.total, bestRating: 5, worstRating: 1 },
            }),
          }}
        />
      )}
    </>
  );
}
