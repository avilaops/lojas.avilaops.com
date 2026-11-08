import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigirTenant } from "@/lib/tenant";
import { buscarProduto } from "@/lib/catalogo";
import { atributosPk, medidasPk, slugsComparacao, TENANT_PK, textoAtributoPk } from "@/lib/pk-produtos";
import { Comparador } from "@/components/pk/Comparador";

export const metadata: Metadata = { title: "Comparar produtos", robots: { index: false, follow: true } };

export default async function CompararPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const tenant = await exigirTenant();
  if (tenant.slug !== TENANT_PK || tenant.status !== "ATIVA") notFound();
  const params = await searchParams;
  const recebidos = params.produto === undefined ? [] : Array.isArray(params.produto) ? params.produto : [params.produto];
  const slugs = slugsComparacao(recebidos);
  if (!slugs) return <main className="mx-auto max-w-6xl space-y-4 px-4 py-10"><h1 className="text-3xl font-bold">Comparar produtos</h1><p>Seleção inválida. Use até 3 produtos do catálogo.</p><Comparador tenantSlug={tenant.slug} produtos={[]}/></main>;
  const encontrados = await Promise.all(slugs.map(slug => buscarProduto(tenant.id, slug)));
  const produtos = encontrados.flatMap(p => {
    if (!p) return [];
    const a = atributosPk(p.atributos), m = medidasPk(p.atributos);
    const medidas = ([ ["DI", m.di], ["DE", m.de], ["Altura", m.altura], ["Seção", m.secao] ] as const).map(([nome, valor]) => `${nome}: ${valor === null ? "não informado" : `${valor.toLocaleString("pt-BR")} mm`}`).join(" · ");
    return [{ slug: p.slug, nome: p.nome, medidas, material: textoAtributoPk(a.material), perfil: textoAtributoPk(a.perfil), aplicacao: textoAtributoPk(a.aplicacao) }];
  });
  return <main className="mx-auto max-w-6xl space-y-6 px-4 py-10"><h1 className="text-3xl font-bold">Comparar produtos PK</h1>{produtos.length < slugs.length && <p role="status">Um ou mais produtos não estão disponíveis para comparação pública.</p>}<Comparador tenantSlug={tenant.slug} produtos={produtos}/></main>;
}
