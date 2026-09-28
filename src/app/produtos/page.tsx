import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { metadataDeListagem } from "@/lib/seo-listagem";
import PaginacaoLoja, { POR_PAGINA, paginaDaUrl } from "@/components/PaginacaoLoja";
import { exigirTenant, lojaVende, temaDo } from "@/lib/tenant";
import CategoriasPremium from "@/components/templates/automotivo-premium/Categorias";
import { listarCategorias, paginaDeProdutos, facetasTecnicas, grafiasDaMarca, medidasDaLoja } from "@/lib/catalogo";
import { filtroDaUrl } from "@/lib/filtros-url";
import ProductCard from "@/components/ProductCard";
import FiltrosProdutos from "@/components/FiltrosProdutos";
import { minhaMoto } from "@/lib/minha-moto";
import { nomeDaMoto } from "@/lib/motos";

type SP = Record<string, string | undefined>;

/**
 * Só a listagem limpa e as suas páginas entram no índice. Busca, faixa de
 * preço, medida e ordenação são estado de quem está olhando: noindex, com
 * follow para os produtos dentro continuarem sendo descobertos.
 */
export async function generateMetadata({ searchParams }: { searchParams: Promise<SP> }): Promise<Metadata> {
  const sp = await searchParams;
  return metadataDeListagem({ base: "/produtos", sp, pagina: paginaDaUrl(sp), title: sp.q ? `Busca: ${sp.q}` : "Produtos" });
}

export default async function Produtos({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const t = await exigirTenant();
  const premium = temaDo(t).layout === "automotivo-premium";
  const sp = await searchParams;
  const moto = t.segmento === "motopecas" ? await minhaMoto(sp) : null;
  const filtro = filtroDaUrl(sp);
  // Conta e pagina o mesmo conjunto já filtrado, inclusive medidas e relevância.
  const pagina = paginaDaUrl(sp);
  const facetasP = facetasTecnicas(t.id, sp.categoria || undefined);
  const [categorias, temMedida, facetas, lote] = await Promise.all([
    listarCategorias(t.id),
    // O filtro de medida só aparece onde faz sentido: loja de roupa não tem
    // diâmetro interno, e campo que nunca filtra nada é ruído no formulário.
    medidasDaLoja(t.id, sp.categoria || undefined),
    facetasP,
    // A marca escolhida vale para todas as grafias dela no cadastro; sem marca
    // escolhida a consulta não espera pelas facetas.
    (filtro.fabricante ? facetasP.then((f) => grafiasDaMarca(f.fabricantes, filtro.fabricante)) : Promise.resolve(undefined))
      .then((fabricante) => paginaDeProdutos(t.id, { ...filtro, fabricante, moto }, POR_PAGINA, (pagina - 1) * POR_PAGINA)),
  ]);
  const produtos = lote.produtos;
  const temProxima = lote.total > pagina * POR_PAGINA;
  // Página além do fim é 404, não "nada encontrado" com 200: senão qualquer
  // ?pagina=999999 vira uma URL válida a mais para o Google guardar.
  if (produtos.length === 0 && pagina > 1) notFound();
  const vende = lojaVende(t);
  const categoriaAtual = categorias.find((c) => c.slug === sp.categoria);
  const titulo = sp.q ? `Resultados para “${sp.q}”` : categoriaAtual ? categoriaAtual.nome : moto ? `Peças para ${nomeDaMoto(moto)}` : "Todos os produtos";

  return (
    <div className="container-loja py-8 ap-catalogo">
      {premium && <CategoriasPremium categorias={[...categorias].sort((a,b)=>a.ordem-b.ordem)} atual={sp.categoria ?? "todas"}/>}
      <h1 className="mb-1 text-2xl font-bold">{titulo}</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        {lote.total} {lote.total === 1 ? "produto encontrado" : "produtos encontrados"} · Página {pagina}
        {moto && (sp.q || categoriaAtual) && <>Mostrando o que serve na {nomeDaMoto(moto)}</>}
        {moto && <> · <Link href="/produtos?moto=todas" className="underline">ver catálogo completo</Link></>}
      </p>
      <FiltrosProdutos categorias={categorias} valores={sp} medidas={temMedida} fabricantes={facetas.fabricantes} perfis={facetas.perfis} />
      {produtos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nada encontrado com esses filtros. Confira o nome, o código ou a referência do produto, ou reduza os filtros.
          {temMedida.length > 0 && <> Medidas: interno × externo × altura, em mm.</>}{" "}
          {/* A navegação completa restaura também os campos não controlados do formulário. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/produtos" className="underline">Limpar filtros</a>
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {produtos.map((p) => (
            <ProductCard loja={t} key={p.id} produto={p} vende={vende} whatsapp={t.whatsapp} moto={moto} />
          ))}
        </div>
      )}
      <PaginacaoLoja base="/produtos" sp={sp} pagina={pagina} temProxima={temProxima} total={lote.total} />
    </div>
  );
}
