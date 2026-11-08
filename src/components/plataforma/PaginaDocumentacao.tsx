import Link from "next/link";
import { ArrowRight, ChevronRight, Code2, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import IndiceAjuda from "./IndiceAjuda";
import "./documentacao.css";

type Props = {
  titulo: string;
  descricao: string;
  tipo: "tecnica" | "privacidade";
  capitulos: readonly { id: string; titulo: string }[];
  children: ReactNode;
};

export default function PaginaDocumentacao({ titulo, descricao, tipo, capitulos, children }: Props) {
  const privacidade = tipo === "privacidade";
  const Icone = privacidade ? ShieldCheck : Code2;
  return <div className="pl-site-claro documentacao-shell">
    <div className="documentacao-container">
      <nav className="documentacao-caminho" aria-label="Caminho da página">
        <Link href="/">Início</Link><ChevronRight size={13} aria-hidden="true" />
        {privacidade && <><Link href="/developers">Desenvolvedores</Link><ChevronRight size={13} aria-hidden="true" /></>}
        <span aria-current="page">{privacidade ? "Privacidade do conector" : "Desenvolvedores"}</span>
      </nav>
      <header className="documentacao-intro">
        <div className="documentacao-selo"><Icone size={22} strokeWidth={1.7} aria-hidden="true" /></div>
        <div><span className="documentacao-kicker">{privacidade ? "Privacidade e acesso" : "Para desenvolvedores"}</span>
          <h1>{titulo}</h1><p>{descricao}</p>
        </div>
      </header>
      <nav className="documentacao-abas" aria-label="Documentação do conector">
        <Link href="/developers" aria-current={!privacidade ? "page" : undefined}><Code2 size={16} aria-hidden="true" />Integrações e API</Link>
        <Link href="/developers/privacidade" aria-current={privacidade ? "page" : undefined}><ShieldCheck size={16} aria-hidden="true" />Privacidade</Link>
      </nav>
      <div className="documentacao-layout">
        <aside className="documentacao-indice"><IndiceAjuda capitulos={capitulos} rotulo="Seções da documentação" />
          <div className="documentacao-voltar"><p>Precisa de ajuda com a loja?</p><Link href="/ajuda">Ver guia do lojista <ArrowRight size={14} aria-hidden="true" /></Link></div>
        </aside>
        <article className="documentacao-conteudo" aria-label={titulo}>{children}
          <footer className="documentacao-rodape"><span>Continue no painel da sua loja</span><Link href="/painel">Acessar painel <ArrowRight size={15} aria-hidden="true" /></Link></footer>
        </article>
      </div>
    </div>
  </div>;
}
