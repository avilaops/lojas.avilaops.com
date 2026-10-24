import { prisma } from "@/lib/db";
import { resolverLooks, slugsDosLooks } from "@/lib/atelie";
import { temaNaVitrine } from "@/lib/flags";
import { exigirTenant, identidadeDa, lojaVende, temaDo } from "@/lib/tenant";
import { listarCategorias, listarProdutos, marcasDaLoja, motosDaLoja, necessidadesDaLoja, provaSocialDa, vitrineDaLoja } from "@/lib/catalogo";
import { minhaMoto } from "@/lib/minha-moto";
import * as regrasProduto from "@/lib/produto-regras";
import Garagem from "@/components/home/Garagem";
import ProvaSocial from "@/components/home/ProvaSocial";
import { comporHome } from "@/components/home/composicao";
import { identidadePublica } from "@/lib/identidade-publica";
import { dadosDaHomeIndustrial } from "@/lib/home-industrial";
import { usaBlocoProprio } from "@/lib/templates";

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
export async function generateMetadata() {
  const t = await exigirTenant();
  if (temaNaVitrine(temaDo(t)).layout !== "industrial") return { alternates: { canonical: "/" } };
  const categorias = await listarCategorias(t.id);
  const familias = categorias.slice(0, 3).map((categoria) => categoria.nome).join(", ");
  const description = `${t.nome}: ${familias ? `catálogo de ${familias}. ` : "Catálogo de peças industriais. "}Busque por código ou medidas e confira a ficha técnica de cada produto.`;
  return { alternates: { canonical: "/" }, description };
}

export default async function Home() {
  const t = await exigirTenant();
  const motopecas = t.segmento === "motopecas";
  const moto = motopecas ? await minhaMoto() : null;
  const tema = temaDo(t);
  const publicado = temaNaVitrine(tema);
  const layoutAtual = publicado.layout;
  const campanhaVisual = layoutAtual === "distribuidora" && ((tema.campanhasHome?.length ?? 0) > 0 || Boolean(t.bannerUrl));
  const [categorias, destaques, prova, motos, marcas, necessidades] = await Promise.all([
    listarCategorias(t.id),
    // Nenhum layout mostra mais de 10 destaques: pedir mais é carregar o que
    // o lojista marcou ao longo de meses para descartar na tela.
    listarProdutos(t.id, { destaque: true, moto, limite: 12, ...(campanhaVisual ? { imagemOrigem: "propria" as const, compraveis: true } : {}) }),
    campanhaVisual ? { media: null, total: 0, avaliacoes: [] } : provaSocialDa(t.id),
    motopecas ? motosDaLoja(t.id) : null,
    motopecas || layoutAtual === "industrial" || usaBlocoProprio(publicado, "categorias") ? marcasDaLoja(t.id) : [],
    t.segmento === "farmacia" ? necessidadesDaLoja(t.id) : undefined,
  ]);
  const vitrine = campanhaVisual
      ? await (async () => {
        const destaquesProntos = destaques.filter((produto) => produto.imagemOrigem === "propria" && produto.imagens.length > 0 && regrasProduto.compravel(produto));
        const completas = (await vitrineDaLoja(t.id, { moto, limite: 24, imagemOrigem: "propria", compraveis: true }))
          .filter((produto) => produto.imagens.length > 0 && regrasProduto.compravel(produto));
        const idsDestaques = new Set(destaquesProntos.map((produto) => produto.id));
        const comFotoPropria = [...destaquesProntos, ...completas.filter((produto) => !idsDestaques.has(produto.id))].slice(0, 12);
        if (comFotoPropria.length) return comFotoPropria;
        // Loja cujo catálogo inteiro usa foto de série (peça técnica vendida
        // por desenho de catálogo) não tem o que passar no filtro acima, e a
        // home com banner ficava com a seção de produtos vazia. Aí valem os
        // destaques e a vitrine comuns, como na home sem banner.
        const destaquesComuns = await listarProdutos(t.id, { destaque: true, moto, limite: 12 });
        return destaquesComuns.length ? destaquesComuns : vitrineDaLoja(t.id, { moto });
      })()
    : destaques.length ? destaques : await vitrineDaLoja(t.id, { moto });
  const slugs = publicado.layout === "atelie" ? slugsDosLooks(tema) : [];
  const pecasDoLook = slugs.length
    ? await prisma.produto.findMany({ where: { tenantId: t.id, ativo: true, slug: { in: slugs } } })
    : [];
  const looks = publicado.layout === "atelie" ? resolverLooks(tema, pecasDoLook) : [];
  const industrial = dadosDaHomeIndustrial(categorias, marcas);
  const dados = {
    t,
    identidade: identidadeDa(t),
    identidadePublica: identidadePublica(t),
    categorias: layoutAtual === "industrial" ? industrial.categorias : categorias,
    marcas: industrial.marcas,
    vitrine,
    temDestaques: destaques.length > 0,
    vende: lojaVende(t),
    moto,
    necessidades,
    looks,
  };

  return (
    <>
      {comporHome(publicado, dados)}
      {motos && <Garagem moto={moto} motos={motos} marcas={marcas} nomeDaLoja={t.nome} />}
      {!campanhaVisual && <ProvaSocial dados={prova} nomeDaLoja={t.nome} />}
      {!campanhaVisual && prova.media !== null && prova.total >= 3 && (
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
