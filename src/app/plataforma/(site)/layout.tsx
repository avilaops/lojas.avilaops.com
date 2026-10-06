import Link from "next/link";
import { ArrowRight, Menu } from "lucide-react";
import { lojistaAtual } from "@/lib/sessao";
import "../plataforma.css";

function MarcaLojas() {
  return (
    <span className="pl-marca">
      <span className="pl-marca-simbolo" aria-hidden="true"><span /></span>
      <span className="pl-marca-texto"><strong>Lojas</strong><small>por Avila Ops</small></span>
    </span>
  );
}

export default async function PlataformaLayout({ children }: { children: React.ReactNode }) {
  const lojista = await lojistaAtual();
  return (
    <div className="plataforma-shell">
      <header className="pl-header">
        <div className="pl-container pl-header-inner">
          <Link href="/" aria-label="Lojas por Avila Ops"><MarcaLojas /></Link>
          <nav className="pl-nav" aria-label="Navegação principal">
            <Link href="/#recursos">Como funciona</Link>
            <Link href="/#modelos">Layouts</Link>
            <Link href="/#planos">Planos</Link>
            <Link href="/blog">Blog</Link>
            <Link href="/ajuda">Ajuda</Link>
          </nav>
          <div className="pl-header-acoes">
            {lojista ? (
              <>
                <Link href="/painel" className="pl-header-entrar">Painel · {lojista.nome}</Link>
                <form action="/api/painel/sair" method="post"><button className="pl-header-sair">Sair</button></form>
              </>
            ) : (
              <>
                <Link href="/entrar" className="pl-header-entrar">Entrar</Link>
                <Link href="/criar" className="pl-header-cta">Criar minha loja <ArrowRight size={14} /></Link>
              </>
            )}
          </div>
          <details className="pl-menu-mobile">
            <summary aria-label="Abrir menu"><Menu size={20} /></summary>
            <nav>
              <Link href="/#recursos">Como funciona</Link><Link href="/#modelos">Layouts</Link><Link href="/#planos">Planos</Link><Link href="/blog">Blog</Link><Link href="/ajuda">Ajuda</Link>
              <Link href="/entrar">Entrar</Link><Link href="/criar">Criar minha loja</Link>
            </nav>
          </details>
        </div>
      </header>
      <main>{children}</main>
      <footer className="pl-footer">
        <div className="pl-container pl-footer-grid">
          <div><MarcaLojas /><p>Loja virtual pronta em um dia. Pix na hora, sem comissão.</p></div>
          <div><strong>Produto</strong><Link href="/#recursos">Como funciona</Link><Link href="/#modelos">Layouts</Link><Link href="/#planos">Planos</Link><Link href="/criar">Criar loja</Link></div>
          <div><strong>Recursos</strong><Link href="/ajuda">Ajuda</Link><Link href="/blog">Blog</Link><Link href="/developers">Desenvolvedores</Link></div>
          <div><strong>Acesso</strong><Link href="/entrar">Painel do lojista</Link><a href="https://avilaops.com">Avila Ops</a></div>
        </div>
        <div className="pl-container pl-footer-base"><span>© {new Date().getFullYear()} Avila Ops.</span><span>Feito no Brasil para negócios que querem crescer.</span></div>
      </footer>
    </div>
  );
}
