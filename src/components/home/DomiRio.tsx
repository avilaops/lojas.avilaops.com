import Link from "@/components/LinkLoja";
import { ArrowRight, FileText, MessageCircle, PackageCheck, Truck } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import { LinkContatoMedido } from "@/components/EventoFunil";
import { linkWhatsApp } from "@/components/WhatsAppFlutuante";
import Comercial, { abertura } from "@/content/domirio/comercial.mdx";
import BuscaCatalogo from "@/components/domirio/BuscaCatalogo";
import styles from "@/components/domirio/comercial.module.css";
import type { DadosHome } from "./tipos";

export default function DomiRio({ t, categorias, vitrine, vende, apresentacoes }: DadosHome) {
  const contato = t.whatsapp ? linkWhatsApp(t.whatsapp, "Olá, Domi-Rio! Gostaria de cotar produtos para minha empresa ou revenda.") : null;
  return <main className={styles.home}>
    <section className={styles.hero}>
      <div className={`container-loja ${styles.heroGrid}`}>
        <div><p className={styles.selo}>{abertura.selo}</p><h1>{abertura.titulo}</h1><p className={styles.intro}>{abertura.texto}</p>
          <BuscaCatalogo />
          <div className={styles.acoes}><Link href="#produtos-domirio" className="btn-primario">Explorar produtos <ArrowRight size={18} aria-hidden="true" /></Link><Link href="/cotacao" className={styles.link}>Comprar para minha empresa <ArrowRight size={16} aria-hidden="true" /></Link></div>
        </div>
        <aside className={styles.heroProdutos} aria-label="Conheça as linhas da loja">
          {vitrine.slice(0, 3).map(p => <Link key={p.id} href={`/produtos/${p.slug}`}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.imagens[0]} alt="" width={220} height={220} /><span>{p.nome}</span><ArrowRight size={16} aria-hidden="true" /></Link>)}
          <p>Confira a embalagem e a apresentação em cada produto.</p>
        </aside>
      </div>
    </section>
    <div className={`container-loja ${styles.beneficios}`}><p><PackageCheck size={20} aria-hidden="true" />Compra pelo site</p><p><Truck size={20} aria-hidden="true" />Frete e prazo pelo CEP</p><p><MessageCircle size={20} aria-hidden="true" />Cotação com o comercial</p><Link href="/politicas/envio"><FileText size={20} aria-hidden="true" />Conheça a entrega</Link></div>
    <section className={`container-loja ${styles.secao}`} aria-labelledby="categorias-domirio"><header><div><p className={styles.selo}>Encontre sua linha</p><h2 id="categorias-domirio">O que você está procurando?</h2></div><Link href="/produtos" className={styles.link}>Todo o catálogo <ArrowRight size={16} aria-hidden="true" /></Link></header>
      <nav className={styles.categorias} aria-label="Categorias Domi-Rio">{categorias.map(c => <Link key={c.id} href={`/categoria/${c.slug}`}>{c.nome}<ArrowRight size={17} aria-hidden="true" /></Link>)}</nav>
    </section>
    <section className={`container-loja ${styles.secao}`} id="produtos-domirio" aria-labelledby="titulo-produtos-domirio"><header><div><p className={styles.selo}>Explore o catálogo</p><h2 id="titulo-produtos-domirio">Produtos de diferentes linhas, em um só lugar.</h2></div><Link href="/produtos" className={styles.link}>Ver todos <ArrowRight size={16} aria-hidden="true" /></Link></header>
      {vitrine.length ? <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{vitrine.map(p => <ProductCard key={p.id} loja={t} produto={p} vende={vende} whatsapp={t.whatsapp} apresentacoes={apresentacoes?.[p.id]} />)}</div> : <p>Consulte o catálogo ou fale com a equipe para localizar um produto.</p>}
      <div className={styles.rodapeSecao}><Link href="/produtos" className="btn-secundario">Ver catálogo completo <ArrowRight size={18} aria-hidden="true" /></Link></div>
    </section>
    <section className={`container-loja ${styles.secao}`} id="comercial-domirio" aria-labelledby="titulo-comercial-domirio"><div className={styles.empresas}><div className={styles.textoMdx}><p className={styles.selo}>Atendimento comercial</p><Comercial components={{ h2: props => <h2 {...props} id="titulo-comercial-domirio" /> }} /></div><div className={styles.passos}><ol><li><span>01</span>Escolha os produtos e as apresentações.</li><li><span>02</span>Informe a quantidade e seu CEP no atendimento.</li><li><span>03</span>Receba a cotação antes de decidir.</li></ol><Link href="/cotacao" className="btn-primario">Montar lista de cotação <ArrowRight size={18} aria-hidden="true" /></Link>{contato && <LinkContatoMedido href={contato} target="_blank" rel="noopener noreferrer" className={styles.link}><MessageCircle size={16} aria-hidden="true" />Falar direto no WhatsApp</LinkContatoMedido>}<p>Reúna os itens e revise a mensagem antes de enviar.</p></div></div></section>
  </main>;
}
