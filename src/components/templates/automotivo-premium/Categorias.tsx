import Link from "next/link";
import Image from "next/image";
import { LayoutGrid } from "lucide-react";
import type { Categoria } from "@prisma/client";
import Trilho from "./Trilho";
import IconeCuidado from "./IconeCuidado";

export default function Categorias({ categorias, atual }: { categorias: Pick<Categoria, "slug" | "nome" | "imagemUrl">[]; atual?: string }) {
  return <nav className="ap-categorias container-loja" aria-label="Comprar por categoria"><Trilho titulo="Categorias" compacto>
    <Link href="/produtos" className="ap-categoria" aria-current={atual === "todas" ? "page" : undefined}><span><LayoutGrid size={25}/></span><strong>Tudo</strong></Link>
    {categorias.map(c => <Link href={`/categoria/${c.slug}`} key={c.slug} className="ap-categoria" aria-current={c.slug === atual ? "page" : undefined}>
      <span>{c.imagemUrl ? <Image unoptimized src={c.imagemUrl} alt="" width={112} height={112} loading="lazy"/> : <IconeCuidado tipo={c.slug} width={28}/>}</span><strong>{c.nome}</strong>
    </Link>)}
  </Trilho></nav>;
}
