import type { Categoria } from "@prisma/client";
import { ArrowUpRight, Bug, Leaf, Rat, SprayCan, TreePine, Wind, Package } from "lucide-react";
import Link from "@/components/LinkLoja";
import { categoriasHome } from "@/content/domirio/comercial.mdx";
import styles from "./categorias-home.module.css";

const icones = {
  "controle-de-pragas": Bug,
  "controle-de-odores": Wind,
  "formicida-cupinicida": TreePine,
  "controle-de-roedores": Rat,
  herbicidas: Leaf,
  inseticida: SprayCan,
};

export default function CategoriasHome({ categorias }: { categorias: Pick<Categoria, "id" | "nome" | "slug">[] }) {
  if (!categorias.length) return null;
  return <section className={`container-loja ${styles.secao}`} aria-labelledby="categorias-domirio">
    <header className={styles.cabecalho}><h2 id="categorias-domirio">{categoriasHome.titulo}</h2><Link href="/produtos">{categoriasHome.catalogo}<ArrowUpRight size={16} aria-hidden="true" /></Link></header>
    <nav className={styles.grade} aria-label="Categorias Domi-Rio">{categorias.map(c => {
      const Icone = icones[c.slug as keyof typeof icones] ?? Package;
      return <Link key={c.id} href={`/categoria/${c.slug}`} className={styles.categoria}><span className={styles.icone}><Icone size={22} strokeWidth={1.7} aria-hidden="true" /></span><span className={styles.nome}>{c.nome}</span><ArrowUpRight className={styles.seta} size={15} aria-hidden="true" /></Link>;
    })}</nav>
  </section>;
}
