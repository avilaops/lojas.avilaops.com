import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Search, MessageCircle, Instagram } from "lucide-react";
import type { DadosHome } from "@/components/home/tipos";
import ProductCard from "@/components/ProductCard";
import BeneficiosBarra from "@/components/home/BeneficiosBarra";
import { temaDo } from "@/lib/tenant";
import { linkWhatsApp } from "@/components/WhatsAppFlutuante";
import { categoriaPorPictograma, etapasDoPremium } from "@/lib/etapas-premium";
import Categorias from "./Categorias";
import Trilho from "./Trilho";
import IconeCuidado from "./IconeCuidado";

export default function HomePremium({ t, identidade, categorias, vitrine, vende }: DadosHome) {
  const conteudo = temaDo(t).premium ?? {};
  const etapas = etapasDoPremium(conteudo, categorias);
  const acessorios = categoriaPorPictograma("acessorios", categorias);
  const atendimento = t.whatsapp ? linkWhatsApp(t.whatsapp, "Olá! Quero ajuda para escolher os produtos e montar meu kit de cuidados.") : "/contato";
  return <div className="ap-home">
    <section className="ap-busca container-loja" aria-label="Encontrar produtos"><label htmlFor="ap-busca">{conteudo.buscaTitulo ?? "O que você procura para o seu carro?"}</label><form action="/produtos" className="ap-busca-form"><Search size={19}/><input id="ap-busca" type="search" name="q" placeholder={conteudo.buscaExemplo ?? "Produto, marca ou aplicação…"}/><button type="submit">Buscar</button></form></section>
    <section className="ap-hero-area"><div className="ap-hero">
      {t.bannerUrl && <Image src={t.bannerUrl} alt="" fill sizes="(max-width: 768px) 100vw, 1200px" preload unoptimized className="ap-hero-imagem"/>}
      <div className="ap-hero-conteudo">{conteudo.heroSelo && <p className="ap-selo">{conteudo.heroSelo}</p>}<h1>{conteudo.heroTitulo ?? t.slogan ?? t.nome}</h1><p>{conteudo.heroTexto ?? identidade.diferencial}</p><div className="ap-hero-acoes"><Link className="btn-primario" href="/produtos">Explorar produtos <ArrowRight size={17}/></Link><a href={atendimento} {...(t.whatsapp ? { target: "_blank", rel: "noopener noreferrer" } : {})}>Montar meu kit <ArrowRight size={14}/></a></div></div>
    </div></section>
    <div className="ap-faixa-categorias"><Categorias categorias={[...categorias].filter(c=>c.imagemUrl || temaDo(t).categoriaSemImagem === "icone").sort((a,b)=>a.ordem-b.ordem)}/></div>
    <section className="container-loja ap-secao"><div className="ap-secao-titulo"><div><p className="ap-sobretitulo">Escolhidos para a sua rotina</p><h2>Destaques</h2></div><Link href="/produtos">Ver catálogo <ArrowRight size={16}/></Link></div><Trilho titulo="Produtos em destaque">{vitrine.map(p => <ProductCard key={p.id} produto={p} vende={vende} whatsapp={t.whatsapp}/>)}</Trilho></section>
    <div className="container-loja ap-beneficios"><BeneficiosBarra t={t}/></div>
    {etapas.length > 0 && <section className="container-loja ap-secao"><div className="ap-secao-titulo"><div><p className="ap-sobretitulo">Cada etapa tem seu produto</p><h2>O cuidado começa na escolha.</h2><p>Encontre o que precisa pelo que você quer fazer.</p></div></div><div className="ap-etapas">{etapas.map((e,i) => <Link href={`/categoria/${e.categoria}`} key={e.categoria}><span className="ap-etapa-numero">0{i+1}</span><IconeCuidado tipo={e.icone}/><h3>{e.titulo}</h3><p>{e.texto}</p><ArrowRight className="ap-etapa-seta" size={19}/></Link>)}</div></section>}
    {conteudo.editorialImagem && <section className="container-loja ap-secao"><div className="ap-editorial"><div className="ap-editorial-foto"><Image src={conteudo.editorialImagem} alt="Detalhe editorial de cuidado com a pintura automotiva" fill sizes="(max-width: 768px) 100vw, 600px" unoptimized/><span>Imagem editorial</span></div><div className="ap-editorial-texto"><p className="ap-sobretitulo">Atenção em cada detalhe</p><h2>{conteudo.editorialTitulo ?? "Seu carro merece uma escolha bem feita."}</h2><p>{conteudo.editorialTexto ?? "Encontre produtos para cada etapa e fale com a equipe quando precisar de orientação."}</p><a href={atendimento} className="btn-primario" {...(t.whatsapp ? {target:"_blank",rel:"noopener noreferrer"} : {})}><MessageCircle size={18}/> Falar com a equipe</a><Link href="/sobre">Conheça {t.nome} <ArrowRight size={16}/></Link></div></div></section>}
    {conteudo.editorialImagemSecundaria && <section className="container-loja ap-secao ap-editorial-secundaria"><div className="ap-editorial-mini-foto"><Image src={conteudo.editorialImagemSecundaria} alt="Ferramentas e acessórios de cuidado automotivo" fill sizes="(max-width: 768px) 100vw, 440px" unoptimized/><span>Imagem editorial</span></div><div><p className="ap-sobretitulo">A rotina completa</p><h2>Ferramentas certas deixam o resultado mais bonito.</h2><p>Microfibras, pincéis e aplicadores fazem parte do cuidado tanto quanto o produto escolhido.</p><Link href={acessorios ? `/categoria/${acessorios.slug}` : "/produtos"} className="btn-secundario">Ver {acessorios ? acessorios.nome.toLocaleLowerCase("pt-BR") : "o catálogo"} <ArrowRight size={16}/></Link></div></section>}
    {t.instagram && <aside className="container-loja ap-social"><Instagram size={24}/><div><strong>O cuidado continua por lá.</strong><p>Acompanhe {t.nome} no Instagram.</p></div><a href={t.instagram} target="_blank" rel="noopener noreferrer">Ver Instagram <ArrowRight size={17}/></a></aside>}
  </div>;
}
