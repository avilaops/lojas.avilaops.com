import Link from "next/link";
import type { Metadata } from "next";
import type { ComponentPropsWithoutRef } from "react";
import { ArrowRight, BookOpen, Check, LifeBuoy, Package, Store, Truck } from "lucide-react";
import ConteudoAjuda, { capitulos } from "@/content/ajuda.mdx";
import IndiceAjuda from "@/components/plataforma/IndiceAjuda";
import "./ajuda.css";

export const metadata: Metadata = {
  title: "Ajuda: como cadastrar a loja, categorias, produtos e pedidos",
  description: "Guias do Lojas Avila Ops para criar a loja, organizar o catálogo, publicar produtos e acompanhar pedidos.",
  alternates: { canonical: "https://lojas.avilaops.com/ajuda" },
};

function TituloCapitulo({ children, className, ...props }: ComponentPropsWithoutRef<"h2">) {
  const partes = typeof children === "string" ? children.match(/^(\d+)\.\s*(.*)$/) : null;
  if (!partes) return <h2 {...props} className={className}>{children}</h2>;
  return <h2 {...props} className={`ajuda-titulo-capitulo ${className ?? ""}`}>
    <span aria-hidden="true">{partes[1].padStart(2, "0")}</span><span>{partes[2]}</span>
  </h2>;
}

const ATALHOS = [
  { href: "#criar", titulo: "Começar minha loja", descricao: "Conta, marca e primeiros passos", icone: Store },
  { href: "#produtos", titulo: "Organizar meu catálogo", descricao: "Produtos, fotos e categorias", icone: Package },
  { href: "#pedidos", titulo: "Cuidar dos pedidos", descricao: "Do pagamento à entrega", icone: Truck },
];

export default function Ajuda() {
  return <div className="pl-site-claro ajuda-shell">
    <div className="pl-container ajuda-container">
      <header className="ajuda-intro">
        <div className="ajuda-apresentacao">
          <div className="ajuda-sobretitulo"><span><BookOpen size={15} aria-hidden="true" /> Central de ajuda</span><span>Guia do lojista</span></div>
          <h1>Sua loja, um passo<br className="ajuda-quebra" /> de cada vez.</h1>
          <p>Encontre o que precisa para começar, organizar o catálogo e acompanhar cada pedido.</p>
          <Link href="/painel" className="ajuda-painel">Continuar no painel <ArrowRight size={16} aria-hidden="true" /></Link>
        </div>
        <div className="ajuda-ilustracao" aria-hidden="true">
          <div className="ajuda-ilustracao-faixa" />
          <span className="ajuda-ilustracao-icone"><Store size={30} strokeWidth={1.5} /></span>
          <strong>Vamos por partes.</strong>
          <span>Seu guia para o dia a dia da loja.</span>
          <div><span><Check size={14} /> Começar</span><span><Check size={14} /> Organizar</span><span><Check size={14} /> Vender</span></div>
        </div>
      </header>
      <nav className="ajuda-atalhos" aria-label="Atalhos da ajuda">
        {ATALHOS.map(({ href, titulo, descricao, icone: Icone }) => <a key={href} href={href}>
          <span className="ajuda-atalho-icone"><Icone size={21} strokeWidth={1.7} aria-hidden="true" /></span>
          <span><strong>{titulo}</strong><small>{descricao}</small></span><ArrowRight size={17} aria-hidden="true" />
        </a>)}
      </nav>
      <div className="ajuda-layout">
        <aside className="ajuda-indice">
          <IndiceAjuda capitulos={capitulos} />
          <div className="ajuda-suporte"><LifeBuoy size={21} aria-hidden="true" /><strong>Prefere falar com a gente?</strong><p>No painel você encontra o contato de suporte da sua loja.</p><Link href="/painel">Acessar suporte <ArrowRight size={14} aria-hidden="true" /></Link></div>
        </aside>
        <article className="ajuda-conteudo" aria-label="Guia de uso do Lojas"><ConteudoAjuda components={{ h2: TituloCapitulo, ol: (props: ComponentPropsWithoutRef<"ol">) => <ol {...props} role="list" /> }} />
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
