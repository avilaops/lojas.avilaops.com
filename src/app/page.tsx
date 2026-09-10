import { exigirTenant, identidadeDa, lojaVende, temaDo } from "@/lib/tenant";
import { listarCategorias, listarProdutos, marcasDaLoja, motosDaLoja, provaSocialDa, vitrineDaLoja } from "@/lib/catalogo";
import { minhaMoto } from "@/lib/minha-moto";
import Automotivo from "@/components/home/Automotivo";
import Garagem from "@/components/home/Garagem";
import Classico from "@/components/home/Classico";
import Vitrine from "@/components/home/Vitrine";
import Editorial from "@/components/home/Editorial";
import Minimal from "@/components/home/Minimal";
import ProvaSocial from "@/components/home/ProvaSocial";
import Spotlight from "@/components/home/Spotlight";
import Mercado from "@/components/home/Mercado";
import Distribuidora from "@/components/home/Distribuidora";
import Conversao from "@/components/home/Conversao";

/**
 * Página inicial: um dos layouts fixos (Tenant.tema.layout), todos
 * alimentados pelos mesmos dados. O lojista escolhe a composição; não
 * desenha. Ver src/lib/tema.ts (LAYOUTS).
 */
export default async function Home() {
  const t = await exigirTenant();
  const motopecas = t.segmento === "motopecas";
  const moto = motopecas ? await minhaMoto() : null;
  const [categorias, destaques, prova, motos, marcas] = await Promise.all([
    listarCategorias(t.id),
    listarProdutos(t.id, { destaque: true, moto }),
    provaSocialDa(t.id),
    motopecas ? motosDaLoja(t.id) : null,
    motopecas ? marcasDaLoja(t.id) : [],
  ]);
  const vitrine = destaques.length ? destaques : await vitrineDaLoja(t.id, { moto });
  const dados = { t, identidade: identidadeDa(t), categorias, vitrine, temDestaques: destaques.length > 0, vende: lojaVende(t), moto };

  const layout =
    temaDo(t).layout === "spotlight" ? <Spotlight {...dados} />
    : temaDo(t).layout === "mercado" ? <Mercado {...dados} />
    : temaDo(t).layout === "distribuidora" ? <Distribuidora {...dados} />
    : temaDo(t).layout === "automotivo" ? <Automotivo {...dados} />
    : temaDo(t).layout === "conversao" ? <Conversao {...dados} />
    : temaDo(t).layout === "vitrine" ? <Vitrine {...dados} />
    : temaDo(t).layout === "editorial" ? <Editorial {...dados} />
    : temaDo(t).layout === "minimal" ? <Minimal {...dados} />
    : <Classico {...dados} />;

  return (
    <>
      {layout}
      {motos && <Garagem moto={moto} motos={motos} marcas={marcas} nomeDaLoja={t.nome} />}
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
