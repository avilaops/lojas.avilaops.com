import Link from "next/link";
import MarcaLojas from "@/components/marca/MarcaLojas";
import "../marca-lojas.css";
import "./acesso.css";

export default function AcessoLayout({ children }: { children: React.ReactNode }) {
  return <div className="eq-shell">
    <a href="#conteudo-equipe" className="eq-pular">Pular para o conteúdo</a>
    <header className="eq-header">
      <Link href="/" aria-label="Lojas por Avila Ops — início"><MarcaLojas /></Link>
      <nav aria-label="Navegação de acesso"><Link href="/ajuda">Ajuda</Link><Link href="/entrar">Voltar ao acesso</Link></nav>
    </header>
    <main id="conteudo-equipe" tabIndex={-1}>{children}</main>
    <footer className="eq-footer"><span>Lojas por Avila Ops</span><a href="https://avilaops.com">Site Ávila Ops</a></footer>
  </div>;
}
