import Link from "next/link";
import { lojistaAtual } from "@/lib/sessao";

/**
 * Chrome da plataforma (lojas.avilaops.com): cabeçalho simples, sem carrinho.
 * As lojas têm o próprio layout; este é o da Avila Ops.
 */
export default async function PlataformaLayout({ children }: { children: React.ReactNode }) {
  const lojista = await lojistaAtual();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border">
        <div className="container-loja flex h-14 items-center gap-4">
          <Link href="/" className="font-bold">
            Lojas <span className="text-muted-foreground">by Avila Ops</span>
          </Link>
          <nav className="ml-auto flex items-center gap-4 text-sm">
            {lojista ? (
              <>
                <Link href="/painel" className="font-semibold">Painel · {lojista.nome}</Link>
                <form action="/api/painel/sair" method="post">
                  <button className="text-muted-foreground hover:text-foreground">Sair</button>
                </form>
              </>
            ) : (
              <>
                <Link href="/#planos" className="text-muted-foreground hover:text-foreground">Planos</Link>
                <Link href="/entrar" className="text-muted-foreground hover:text-foreground">Entrar</Link>
                <Link href="/criar" className="btn-primario h-9 px-4">Criar minha loja</Link>
              </>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="border-t border-border py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Avila Ops · <a href="https://avilaops.com" className="underline">avilaops.com</a>
      </footer>
    </div>
  );
}
