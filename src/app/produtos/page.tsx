import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { metadataDeListagem } from "@/lib/seo-listagem";
import PaginacaoLoja, { POR_PAGINA, paginaDaUrl } from "@/components/PaginacaoLoja";
import { exigirTenant, lojaVende, temaDo } from "@/lib/tenant";
import CategoriasPremium from "@/components/templates/automotivo-premium/Categorias";
import { listarCategorias, listarProdutos, marcasDaLoja, medidasDaLoja, type ChaveDeMedida, type OrdemCatalogo } from "@/lib/catalogo";
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

const ORDENS = new Set<OrdemCatalogo>(["relevancia", "menor-preco", "maior-preco", "recentes", "nome"]);
const reais = (v?: string) => {
  if (!v) return undefined;
  const n = Number.parseFloat(v.replace(/[^\d,.]/g, "").replace(",", "."));
  return Number.isFinite(n) ? Math.round(n * 100) : undefined;
};

/** "20", "20,5" ou "20.5" → 20.5. Milímetro aceita vírgula: é como se escreve aqui. */
const mm = (v?: string) => {
  if (!v) return undefined;
  const n = Number.parseFloat(v.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
};

/**
 * Faixas de medida vindas da URL (`di_de`, `di_ate`, `de_de`…). Só entra a
 * medida que tem pelo menos um extremo: faixa vazia não filtra nada e não
 * pode virar `{}`, que excluiria todo produto sem aquele atributo.
 */
function faixasDaUrl(sp: Record<string, string | undefined>) {
  const campos: Array<[ChaveDeMedida, string]> = [
    ["diametroInternoMm", "di"],
    ["diametroExternoMm", "de"],
    ["alturaMm", "alt"],
  ];
  const fora: Partial<Record<ChaveDeMedida, { de?: number; ate?: number }>> = {};
  for (const [campo, prefixo] of campos) {
    const d = mm(sp[`${prefixo}_de`]);
    const a = mm(sp[`${prefixo}_ate`]);
    if (d != null || a != null) fora[campo] = { de: d, ate: a };
  }
  return Object.keys(fora).length ? fora : undefined;
}

export default async function Produtos({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const t = await exigirTenant();
  const premium = temaDo(t).layout === "automotivo-premium";
  const sp = await searchParams;
  const ordem = ORDENS.has(sp.ordem as OrdemCatalogo) ? (sp.ordem as OrdemCatalogo) : "relevancia";
  const moto = t.segmento === "motopecas" ? await minhaMoto(sp) : null;
  const medidas = faixasDaUrl(sp);
  // Paginado, e pedindo um a mais do que mostra: é assim que se sabe se há
  // "Próxima" sem contar o catálogo (contagem é informação de estoque, não
  // de compra). Antes esta página mandava os 5.591 cards da Vedashow de uma
  // vez: 5 s até o primeiro byte e um HTML que o celular não segurava.
  const pagina = paginaDaUrl(sp);
  const [categorias, lote, temMedida, fabricantes] = await Promise.all([
    listarCategorias(t.id),
    listarProdutos(t.id, { busca: sp.q?.trim() || undefined, fabricante: sp.fabricante?.trim() || undefined, categoriaSlug: sp.categoria || undefined, ordem, minCentavos: reais(sp.min), maxCentavos: reais(sp.max), moto, medidas, limite: POR_PAGINA + 1, pular: (pagina - 1) * POR_PAGINA }),
    // O filtro de medida só aparece onde faz sentido: loja de roupa não tem
    // diâmetro interno, e campo que nunca filtra nada é ruído no formulário.
    medidasDaLoja(t.id),
    premium ? marcasDaLoja(t.id) : [],
  ]);
  const produtos = lote.slice(0, POR_PAGINA);
  const temProxima = lote.length > POR_PAGINA;
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
        {/* Sem contagem: o número de itens é informação de estoque, não de
            compra, e o comprador decide pelo produto que está vendo. */}
        {moto && (sp.q || categoriaAtual) && <>Mostrando o que serve na {nomeDaMoto(moto)}</>}
        {moto && <> · <Link href="/produtos?moto=todas" className="underline">ver catálogo completo</Link></>}
      </p>
      <FiltrosProdutos categorias={categorias} valores={sp} medidas={temMedida} fabricantes={fabricantes} />
      {produtos.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          Nada encontrado com esses filtros. <Link href="/produtos" className="underline">Limpar filtros</Link>
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {produtos.map((p) => (
            <ProductCard key={p.id} produto={p} vende={vende} whatsapp={t.whatsapp} moto={moto} />
          ))}
        </div>
      )}
      <PaginacaoLoja base="/produtos" sp={sp} pagina={pagina} temProxima={temProxima} />
    </div>
  );
}
