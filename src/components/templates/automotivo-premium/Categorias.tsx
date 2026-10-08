import Link from "@/components/LinkLoja";
import Image from "next/image";
import { LayoutGrid } from "lucide-react";
import type { Categoria } from "@prisma/client";
import { iconeDaCategoria } from "@/lib/etapas-premium";
import IconeCuidado from "./IconeCuidado";

export default function Categorias({ categorias, atual }: { categorias: Pick<Categoria, "slug" | "nome" | "imagemUrl">[]; atual?: string }) {
  return <nav className="ap-categorias" aria-label="Comprar por categoria">
    <div className="ap-categorias-grade">
      <Link href="/produtos" className="ap-categoria ap-categoria-tudo" aria-current={atual === "todas" ? "page" : undefined}>
        <span><LayoutGrid size={34}/></span><strong>Tudo</strong>
      </Link>
      {categorias.map(c => <Link href={`/categoria/${c.slug}`} key={c.slug} className="ap-categoria" aria-current={c.slug === atual ? "page" : undefined}>
        <span>{c.imagemUrl ? <Image unoptimized src={c.imagemUrl} alt="" fill sizes="(max-width: 640px) 50vw, (max-width: 1100px) 33vw, 25vw" loading="lazy"/> : <IconeCuidado tipo={iconeDaCategoria(c.nome, c.slug)} width={38}/>}</span><strong>{c.nome}</strong>
      </Link>)}
    </div>
  </nav>;
}
