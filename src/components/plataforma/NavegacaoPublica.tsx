"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Menu, X } from "lucide-react";

const LINKS = [
  { href: "/#recursos", titulo: "Como funciona" },
  { href: "/#modelos", titulo: "Layouts" },
  { href: "/#planos", titulo: "Planos" },
  { href: "/blog", titulo: "Blog" },
  { href: "/ajuda", titulo: "Ajuda" },
] as const;

export default function NavegacaoPublica({ loja, equipe }: { loja: string | null; equipe: boolean }) {
  const pathname = usePathname();
  const caminhoPublico = pathname.replace(/^\/plataforma(?=\/|$)/, "") || "/";
  const menu = useRef<HTMLDetailsElement>(null);
  const [aberto, setAberto] = useState(false);

  function fechar(devolverFoco = false) {
    if (!menu.current) return;
    menu.current.open = false;
    if (devolverFoco) menu.current.querySelector("summary")?.focus();
  }

  useEffect(() => {
    function fora(evento: PointerEvent) {
      if (evento.target instanceof Node && !menu.current?.contains(evento.target)) fechar();
    }
    function teclado(evento: KeyboardEvent) {
      if (evento.key === "Escape" && menu.current?.open) fechar(true);
    }
    function redimensionar() {
      if (window.matchMedia("(min-width: 1051px)").matches) fechar();
    }
    document.addEventListener("pointerdown", fora);
    document.addEventListener("keydown", teclado);
    window.addEventListener("resize", redimensionar);
    return () => {
      document.removeEventListener("pointerdown", fora);
      document.removeEventListener("keydown", teclado);
      window.removeEventListener("resize", redimensionar);
    };
  }, []);

  function atual(href: string) {
    return !href.includes("#") && (caminhoPublico === href || caminhoPublico.startsWith(`${href}/`));
  }

  return <>
    <nav className="pl-nav" aria-label="Navegação principal">
      {LINKS.map(({ href, titulo }) => <Link key={href} href={href} aria-current={atual(href) ? "page" : undefined}>{titulo}</Link>)}
    </nav>
    <div className="pl-header-acoes">
      {loja ? <>
        <Link href="/painel" className="pl-header-entrar">Painel · {loja}</Link>
        {equipe && <Link href="/entrar/equipe" className="pl-header-entrar">Trocar loja</Link>}
        <form action="/api/painel/sair" method="post"><button className="pl-header-sair">Sair</button></form>
      </> : <>
        <Link href="/entrar" className="pl-header-entrar">Entrar</Link>
        <Link href="/criar" className="pl-header-cta">Criar minha loja <ArrowRight size={14} aria-hidden="true" /></Link>
      </>}
    </div>
    <details ref={menu} className="pl-menu-mobile" onToggle={(evento) => setAberto(evento.currentTarget.open)}>
      <summary aria-label={aberto ? "Fechar menu" : "Abrir menu"} aria-controls="navegacao-mobile">
        {aberto ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </summary>
      <nav id="navegacao-mobile" aria-label="Navegação principal no celular" onClick={(evento) => {
        if (evento.target instanceof Element && evento.target.closest("a, button")) fechar();
      }}>
        {LINKS.map(({ href, titulo }) => <Link key={href} href={href} aria-current={atual(href) ? "page" : undefined}>{titulo}</Link>)}
        {loja ? <>
          <Link href="/painel">Painel · {loja}</Link>
          {equipe && <Link href="/entrar/equipe">Trocar loja</Link>}
          <form action="/api/painel/sair" method="post"><button className="pl-menu-sair">Sair</button></form>
        </> : <><Link href="/entrar">Entrar</Link><Link href="/criar" className="pl-menu-criar">Criar minha loja</Link></>}
      </nav>
    </details>
  </>;
}
