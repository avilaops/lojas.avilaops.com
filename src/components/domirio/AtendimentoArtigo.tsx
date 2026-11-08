import Link from "@/components/LinkLoja";
import { ArrowRight, MessageCircle } from "lucide-react";
import { LinkContatoMedido } from "@/components/EventoFunil";
import { linkWhatsApp } from "@/components/WhatsAppFlutuante";
import Conteudo from "@/content/domirio/cotar-artigo.mdx";
import { categoriasDoArtigoDomiRio } from "@/lib/domirio-comercial";
import styles from "./comercial.module.css";

export default function AtendimentoArtigo({ serie, titulo, whatsapp, categorias }: { serie: number; titulo: string; whatsapp: string | null; categorias: { slug: string; nome: string }[] }) {
  const pertinentes = categorias.filter(c => categoriasDoArtigoDomiRio(serie).includes(c.slug));
  return <aside className={styles.ponte} aria-labelledby="cotacao-artigo-domirio"><Conteudo components={{ h2: props => <h2 {...props} id="cotacao-artigo-domirio" /> }} />
    <nav aria-label="Pesquisar produtos na Domi-Rio">{pertinentes.map(c => <Link key={c.slug} href={`/categoria/${c.slug}`} className="btn-secundario">{c.nome}<ArrowRight size={16} aria-hidden="true" /></Link>)}<Link href="/produtos" className={styles.link}>Consultar catálogo <ArrowRight size={16} aria-hidden="true" /></Link></nav>
    {whatsapp ? <LinkContatoMedido href={linkWhatsApp(whatsapp, `Olá, Domi-Rio! Li o guia “${titulo}” e gostaria de ajuda para pesquisar produtos no catálogo e preparar uma cotação.`)} target="_blank" rel="noopener noreferrer" className="btn-primario"><MessageCircle size={18} aria-hidden="true" />Falar com o comercial</LinkContatoMedido> : <Link href="/contato" className="btn-primario">Falar com o comercial</Link>}
  </aside>;
}
