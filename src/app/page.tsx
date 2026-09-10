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
/**
 * A home é a página que mais precisa de canonical, e era a única sem.
 *
 * Uma loja pode responder em três endereços ao mesmo tempo: o domínio próprio,
 * o `www` dele e `<loja>.lojas.avilaops.com`. Sem canonical o Google trata os
 * três como páginas diferentes com o mesmo conteúdo e divide o sinal entre
 * eles. Numa migração de domínio isso é pior ainda: é exatamente o canonical
 * que diz ao Google onde consolidar o que a loja antiga já tinha conquistado.
 *
 * A URL absoluta sai do `metadataBase` do layout, que já é o endereço público
 * da loja.
 */
export const metadata = { alternates: { canonical: "/" } };

export default async function Home() {
  const t = await exigirTenant();
  const motopecas = t.segmento === "motopecas";
  const moto = motopecas ? await minhaMoto() : null;
  const [categorias, destaques, prova, motos, marcas] = await Promise.all([
    listarCategorias(t.id),
    // Nenhum layout mostra mais de 10 destaques: pedir mais é carregar o que
    // o lojista marcou ao longo de meses para descartar na tela.
    listarProdutos(t.id, { destaque: true, moto, limite: 12 }),
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
