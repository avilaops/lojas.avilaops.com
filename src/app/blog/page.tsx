import type { Metadata } from "next";
import Link from "next/link";
import { exigirTenant } from "@/lib/tenant";
import { dataLegivel } from "@/lib/publicacoes";
import { listarPublicadas } from "@/lib/publicacoes-consulta";

/**
 * Blog da loja.
 *
 * Fica no domínio da loja, e não em lojas.avilaops.com/blog (aquele é o da
 * plataforma): o texto que responde "com que frequência trocar o óleo" tem de
 * somar autoridade ao domínio de quem vende a peça.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const t = await exigirTenant();
  return {
    title: "Blog",
    description: `Artigos e novidades da ${t.nome}.`,
    alternates: { canonical: "/blog" },
  };
}

export default async function Blog() {
  const t = await exigirTenant();
  const posts = await listarPublicadas(t.id, 30);

  return (
    <div className="container-loja max-w-3xl py-10">
      <h1 className="text-2xl font-bold">Blog</h1>

      {posts.length === 0 ? (
        // Estado vazio sem promessa: "em breve" envelhece mal numa loja que
        // nunca voltou a escrever.
        <p className="mt-4 text-sm text-muted-foreground">Ainda não há publicações por aqui.</p>
      ) : (
        <ul className="mt-6 grid gap-6">
          {posts.map((p) => (
            <li key={p.slug} className="border-b border-border pb-6 last:border-0">
              <article>
                <Link href={`/blog/${p.slug}`} className="group grid gap-3 sm:grid-cols-[180px_1fr] sm:items-start">
                  {p.capaUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.capaUrl} alt="" className="aspect-[4/3] w-full rounded-xl border border-border object-cover" />
                  )}
                  <div className={p.capaUrl ? undefined : "sm:col-span-2"}>
                    <h2 className="text-lg font-semibold group-hover:underline">{p.titulo}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{p.resumo}</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      <time dateTime={p.publicadoEm.toISOString()}>{dataLegivel(p.publicadoEm)}</time>
                      {p.autor && ` · ${p.autor}`}
                    </p>
                  </div>
                </Link>
              </article>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
