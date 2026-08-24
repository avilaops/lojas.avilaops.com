import Link from "next/link";
import type { Tenant } from "@prisma/client";
import { enderecoCompleto } from "@/lib/tenant";

/**
 * Rodapé. O "Loja por Avila Ops" não é opcional nem negociável por desconto
 * (a C2TI dá R$ 20 de desconto para manter o logo; aqui é parte do produto):
 * cada loja no ar é um anúncio da plataforma.
 */
export default function Footer({ tenant, categorias }: { tenant: Tenant; categorias: Array<{ slug: string; nome: string }> }) {
  const avila = process.env.AVILAOPS_URL ?? "https://avilaops.com";
  const endereco = enderecoCompleto(tenant);
  return (
    <footer className="mt-16 border-t border-border bg-muted/40">
      <div className="container-loja grid gap-8 py-10 text-sm md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="text-base font-bold">{tenant.nome}</p>
          {tenant.slogan && <p className="mt-1 text-muted-foreground">{tenant.slogan}</p>}
          {endereco && <p className="mt-3 text-muted-foreground">{endereco}</p>}
          {tenant.horario && <p className="text-muted-foreground">{tenant.horario}</p>}
          {tenant.telefone && <p className="text-muted-foreground">{tenant.telefone}</p>}
        </div>
        <div>
          <p className="mb-2 font-semibold">Categorias</p>
          <ul className="space-y-1 text-muted-foreground">
            {categorias.slice(0, 8).map((c) => (
              <li key={c.slug}>
                <Link href={`/categoria/${c.slug}`}>{c.nome}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-2 font-semibold">A loja</p>
          <ul className="space-y-1 text-muted-foreground">
            <li><Link href="/sobre">Sobre</Link></li>
            <li><Link href="/contato">Contato</Link></li>
            <li><Link href="/politicas/envio">Envio e retirada</Link></li>
            <li><Link href="/politicas/devolucao">Trocas e devoluções</Link></li>
            <li><Link href="/politicas/privacidade">Privacidade</Link></li>
            {tenant.instagram && (
              <li>
                <a href={tenant.instagram} target="_blank" rel="noopener">Instagram</a>
              </li>
            )}
          </ul>
        </div>
      </div>
      <div className="border-t border-border">
        <div className="container-loja flex flex-col items-center justify-between gap-2 py-4 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} {tenant.nome}. Pagamento seguro · dados protegidos (LGPD).</span>
          <a href={avila} target="_blank" rel="noopener" className="font-semibold hover:text-foreground">
            Loja por Avila Ops
          </a>
        </div>
      </div>
    </footer>
  );
}
