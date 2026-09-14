"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, Moon, Sun, UserRound, ChevronDown, Search } from "lucide-react";
import type { TenantPublico } from "@/lib/tenant";
import CartButton from "@/components/cart/CartButton";

function observarModo(avisar: () => void) {
  const observer = new MutationObserver(avisar);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-modo"] });
  return () => observer.disconnect();
}

export default function Cabecalho({ loja, logo, logoEscuro, mostrarNome, categorias, modo }: { loja: TenantPublico; logo: string | null; logoEscuro?: string; mostrarNome?: boolean; categorias: {nome: string; slug: string}[]; modo: "claro" | "escuro" }) {
  const caminho = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const escuro = useSyncExternalStore(observarModo, () => document.documentElement.dataset.modo === "escuro", () => modo === "escuro");
  useEffect(() => { dialog.current?.close(); }, [caminho]);
  function alternar() {
    const proximo = !escuro;
    document.documentElement.dataset.modo = proximo ? "escuro" : "claro";
    document.documentElement.dataset.ckTheme = proximo ? "dark" : "light";
    try { localStorage.setItem(`loja:${loja.slug}:modo`, proximo ? "escuro" : "claro"); } catch { /* preferência da sessão */ }
  }
  const marca = <><span className="ap-marca-simbolo">{logo && <>
    <Image unoptimized className={logoEscuro ? "ap-logo-claro" : undefined} src={logo} alt={mostrarNome ? "" : loja.nome} width={48} height={48}/>
    {logoEscuro && <Image unoptimized className="ap-logo-escuro" src={logoEscuro} alt={mostrarNome ? "" : loja.nome} width={48} height={48}/>}</>}</span>{(mostrarNome || !logo) && <span>{loja.nome}</span>}</>;
  const links = [{href:"/", nome:"Início"}, {href:"/produtos", nome:"Produtos"}, {href:"/sobre", nome:"Sobre"}, {href:"/contato", nome:"Contato"}];
  return <>
    <a href="#conteudo-loja" className="ap-pular">Pular para o conteúdo</a>
    <header className="ap-cabecalho">
      {loja.avisoTopo && <p className="ap-aviso">{loja.avisoTopo}</p>}
      <div className="container-loja ap-cabecalho-linha">
        <button className="ap-icone ap-menu-botao" aria-label="Abrir menu" onClick={() => dialog.current?.showModal()}><Menu size={22}/></button>
        <Link href="/" className="ap-marca" aria-label={`${loja.nome} — início`}>{marca}</Link>
        <nav className="ap-nav" aria-label="Navegação principal">{links.map(l => l.href === "/produtos" ? <details className="ap-megamenu" key={l.href}><summary>Produtos <ChevronDown size={13}/></summary><div><Link href="/produtos">Ver todos os produtos</Link>{categorias.map(c => <Link key={c.slug} href={`/categoria/${c.slug}`} onClick={e => e.currentTarget.closest("details")?.removeAttribute("open")}>{c.nome}</Link>)}</div></details> : <Link key={l.href} href={l.href} aria-current={caminho === l.href ? "page" : undefined}>{l.nome}</Link>)}</nav>
        <div className="ap-cabecalho-acoes"><button className="ap-icone" onClick={alternar} aria-label={escuro ? "Ativar tema claro" : "Ativar tema escuro"}>{escuro ? <Sun size={18}/> : <Moon size={18}/>}</button>{loja.vende && <><Link href="/conta" className="ap-icone ap-conta" aria-label="Minha conta"><UserRound size={19}/></Link><CartButton/></>}</div>
      </div>
    </header>
    <dialog ref={dialog} className="ap-dialog ap-menu-dialog" aria-label={`Menu de ${loja.nome}`} onClick={e => { if(e.target === e.currentTarget) dialog.current?.close(); }}>
      <div className="ap-dialog-topo"><strong>Explore {loja.nome}</strong><button className="ap-icone" aria-label="Fechar menu" onClick={() => dialog.current?.close()}><X/></button></div>
      <form action="/produtos" className="ap-busca-form" onSubmit={() => dialog.current?.close()}><Search size={18}/><input name="q" type="search" aria-label="Buscar no menu" placeholder="Qual produto você procura?"/><button aria-label="Buscar"><Search size={18}/></button></form>
      <nav aria-label="Menu do celular">{links.map(l => <Link key={l.href} href={l.href} onClick={() => dialog.current?.close()}>{l.nome}</Link>)}<hr/>{categorias.map(c => <Link href={`/categoria/${c.slug}`} key={c.slug} onClick={() => dialog.current?.close()}>{c.nome}</Link>)}{loja.vende && <Link href="/conta" onClick={() => dialog.current?.close()}>Minha conta e pedidos</Link>}</nav>
    </dialog>
  </>;
}
