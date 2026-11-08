import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigirTenant, urlDaLoja } from "@/lib/tenant";
import { acharEditorialPk } from "@/lib/pk-editorial";
import { carregarEditorialPk } from "@/content/pkvedacoes/editorial";
import ConteudoEditorial from "@/components/pk/ConteudoEditorial";
export const dynamic = "force-dynamic";
type Props = { params: Promise<{ slug: string }> };
async function resolver(params: Props["params"]) {
  const [{ slug }, t] = await Promise.all([params, exigirTenant()]);
  if (t.slug !== "pkvedacoes") notFound();
  const item = acharEditorialPk(t.slug, "aplicacoes", slug);
  if (!item) notFound();
  return { t, item };
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { item } = await resolver(params);
  return { title: `${item.titulo} | PK Vedações`, description: item.resumo, alternates: { canonical: `/aplicacoes/${item.slug}` }, openGraph: { type: "article", title: item.titulo, description: item.resumo } };
}
export default async function Pagina({ params }: Props) {
  const { t, item } = await resolver(params);
  const Corpo = await carregarEditorialPk("aplicacoes", item.slug);
  if (!Corpo) notFound();
  return <ConteudoEditorial item={item} baseUrl={urlDaLoja(t)}><Corpo /></ConteudoEditorial>;
}

