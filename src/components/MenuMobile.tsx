"use client";

import { useEffect, useRef } from "react";
import Link from "@/components/LinkLoja";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";

type CategoriaMenu = { slug: string; nome: string };

export default function MenuMobile({
  className,
  nome,
  vende,
  mostrarPromocoes,
  categorias,
}: {
  className?: string;
  nome: string;
  vende: boolean;
  mostrarPromocoes: boolean;
  categorias: CategoriaMenu[];
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const caminho = usePathname();

  useEffect(() => {
    dialog.current?.close();
  }, [caminho]);

  return (
    <>
      <button
        type="button"
        className={`menu-mobile-botao ${className ?? ""}`}
        aria-label="Abrir menu de navegação"
        onClick={() => dialog.current?.showModal()}
      >
        <Menu aria-hidden="true" />
      </button>
      <dialog
        ref={dialog}
        className="menu-mobile-dialog"
        aria-label={`Navegação da loja ${nome}`}
        onClick={(evento) => {
          if (evento.target === evento.currentTarget) dialog.current?.close();
        }}
      >
        <div className="menu-mobile-cabecalho">
          <strong>{nome}</strong>
          <button type="button" aria-label="Fechar menu" onClick={() => dialog.current?.close()}>
            <X aria-hidden="true" />
          </button>
        </div>
        <nav aria-label="Navegação móvel">
          <Link href="/">Início</Link>
          <Link href="/produtos">Todos os produtos</Link>
          {mostrarPromocoes && <Link href="/promocoes">Promoções</Link>}
          {vende && <Link href="/conta">Minha conta e pedidos</Link>}
          <div className="menu-mobile-separador" aria-hidden="true">Categorias</div>
          {categorias.map((categoria) => (
            <Link href={`/categoria/${categoria.slug}`} key={categoria.slug}>{categoria.nome}</Link>
          ))}
        </nav>
      </dialog>
    </>
  );
}
