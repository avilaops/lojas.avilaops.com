import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, BookOpen } from "lucide-react";
import ConteudoAjuda, { capitulos } from "@/content/ajuda.mdx";
import "./ajuda.css";

export const metadata: Metadata = {
  title: "Ajuda: como cadastrar a loja, categorias, produtos e pedidos",
  description: "Guias do Lojas Avila Ops para criar a loja, organizar o catálogo, publicar produtos e acompanhar pedidos.",
  alternates: { canonical: "https://lojas.avilaops.com/ajuda" },
};

export default function Ajuda() {
  return <div className="pl-site-claro ajuda-shell">
    <div className="pl-container">
      <header className="ajuda-intro">
        <span><BookOpen size={16} aria-hidden="true" /> Central de ajuda</span>
        <h1>Seu próximo passo começa aqui.</h1>
        <p>Da criação da loja ao acompanhamento dos pedidos. Escolha o assunto e siga as orientações no seu ritmo.</p>
        <Link href="/painel">Abrir meu painel <ArrowRight size={16} aria-hidden="true" /></Link>
      </header>
      <div className="ajuda-layout">
        <aside className="ajuda-indice">
          <nav aria-label="Capítulos da ajuda"><h2>Neste guia</h2>
            <ol>{capitulos.map((capitulo) => <li key={capitulo.id}><a href={`#${capitulo.id}`}>{capitulo.titulo}</a></li>)}</ol>
          </nav>
        </aside>
        <article className="ajuda-conteudo" aria-label="Guia de uso do Lojas"><ConteudoAjuda />
          <footer className="ajuda-proximo">
            <h2>Pronto para continuar?</h2><p>Volte ao painel para colocar o próximo passo em prática.</p>
            <Link href="/painel">Ir para o painel <ArrowRight size={16} aria-hidden="true" /></Link>
            <Link href="/criar">Ainda não tenho uma loja</Link>
          </footer>
        </article>
      </div>
    </div>
  </div>;
}
