import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { exigirTenant } from "@/lib/tenant";
import JornadaPk from "@/components/pk/JornadaPk";
import SegmentosPk from "@/components/pk/SegmentosPk";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  const tenant = await exigirTenant();
  if (tenant.slug !== "pkvedacoes") notFound();
  return { title: "Como escolher sua vedação", description: "Do código, da amostra ou da aplicação à cotação: confira função, medidas, material e perfil na PK Vedações.", alternates: { canonical: "/como-escolher" } };
}

export default async function ComoEscolherPk() {
  const tenant = await exigirTenant();
  if (tenant.slug !== "pkvedacoes") notFound();
  return <main className="container-loja space-y-10 py-10">
    <header className="max-w-3xl"><Link href="/" className="text-sm underline">Início da PK</Link><p className="mt-6 text-xs font-bold uppercase tracking-widest text-primary">Identificar · Entender · Conferir · Cotar</p><h1 className="mt-3 text-3xl font-bold leading-tight sm:text-4xl">Da dúvida sobre a peça à cotação bem identificada.</h1><p className="mt-4 text-lg leading-relaxed text-muted-foreground">Comece com o que você já sabe. A cada etapa, reúna as informações que ajudam a selecionar a reposição para o seu equipamento.</p></header>
    <JornadaPk />
    <section><h2 className="text-2xl font-bold">A função vem antes da referência</h2><div className="mt-5 grid gap-4 md:grid-cols-3">{[
      { titulo: "Conter o fluido", nome: "Gaxetas", descricao: "Participam da vedação da haste ou do êmbolo, conforme o perfil e o alojamento.", href: "/guias/perfis-b-bs-std" },
      { titulo: "Retirar sujeira", nome: "Raspadores", descricao: "Retiram resíduos da haste no retorno e ajudam a reduzir a entrada de contaminantes.", href: "/categoria/raspador-pu-tipo-d" },
      { titulo: "Orientar o movimento", nome: "Anéis guia", descricao: "Contribuem para a centralização e para evitar contato entre superfícies metálicas.", href: "/categoria/anel-guia" },
    ].map(funcao => <div key={funcao.nome} className="rounded-xl border border-border p-6"><p className="text-xs font-bold uppercase tracking-wide text-primary">{funcao.nome}</p><h3 className="mt-2 text-xl font-semibold">{funcao.titulo}</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{funcao.descricao}</p><Link href={funcao.href} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold underline">Explorar {funcao.nome.toLowerCase()}</Link></div>)}</div></section>
    <section><h2 className="text-2xl font-bold">Qual movimento faz parte da sua operação?</h2><SegmentosPk tenantSlug={tenant.slug} /></section>
    <aside className="rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8"><h2 className="text-2xl font-bold">Várias peças para conferir?</h2><p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">Importe uma lista de códigos e quantidades. Confira encontrados, ambiguidades e pendências antes de levar a cotação ao atendimento.</p><Link href="/cotacao-lote" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground">Organizar minha cotação</Link></aside>
  </main>;
}
