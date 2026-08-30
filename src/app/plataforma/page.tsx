import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  Banknote,
  Check,
  ChevronRight,
  Clock3,
  MessageCircleMore,
  PackageCheck,
  Palette,
  QrCode,
  ShieldCheck,
  Sparkles,
  Store,
  Truck,
  Zap,
} from "lucide-react";
import ModelosInterativos from "@/components/plataforma/ModelosInterativos";

export const metadata: Metadata = {
  title: "Lojas Avila Ops — loja virtual pronta em um dia, Pix na hora, sem comissão",
  description:
    "Loja virtual para o comércio de bairro: catálogo, carrinho, Pix na hora, cartão e boleto, frete por CEP, WhatsApp e e-mail profissional por R$ 119 fixos no mês. O dinheiro cai na conta da sua empresa.",
  alternates: { canonical: "https://lojas.avilaops.com" },
  openGraph: {
    title: "Lojas Avila Ops — loja virtual pronta em um dia, Pix na hora, sem comissão",
    description: "R$ 119 fixos no mês, sem comissão sobre venda. O dinheiro cai na conta da sua empresa.",
    url: "https://lojas.avilaops.com",
    siteName: "Lojas Avila Ops",
    locale: "pt_BR",
    type: "website",
    images: [{ url: "/plataforma/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lojas Avila Ops — loja virtual pronta em um dia",
    description: "Pix na hora, sem comissão, R$ 119 fixos no mês.",
    images: ["/plataforma/opengraph-image"],
  },
};

/** Os mesmos três planos do estúdio (/criar), da ficha comercial e de docs/PLANOS.md. */
const PLANOS = [
  {
    id: "SITE",
    nome: "Site",
    rotulo: "Para quem vende pelo WhatsApp",
    preco: 79,
    descricao: "Catálogo com preço no ar e pedido pelo WhatsApp, sem responder \"quanto é?\" o dia inteiro.",
    destaque: false,
    itens: ["Vitrine e catálogo com preço", "Pedido pelo WhatsApp", "Domínio, SSL e hospedagem", "E-mail profissional", "Painel simples"],
  },
  {
    id: "LOJA",
    nome: "Loja",
    rotulo: "O mais escolhido",
    preco: 119,
    destaque: true,
    descricao: "A loja completa: o cliente escolhe, paga na hora e você só vê o pedido chegar.",
    itens: ["Tudo do Site", "Carrinho e checkout na sua loja", "Pix na hora, cartão e boleto", "Frete por CEP e retirada na loja", "Cupons, variações e estoque", "Google Shopping, carrinho abandonado e avaliações", "Relatório semanal no e-mail"],
  },
  {
    id: "LOJA_PRO",
    nome: "Loja Pro",
    rotulo: "Para quem já vende muito",
    preco: 349,
    descricao: "Para distribuidor e atacado: domínio próprio, integrações e atendimento com prioridade.",
    destaque: false,
    itens: ["Tudo da Loja", "Domínio próprio da sua marca", "Chave de API e assistente de IA", "Cotação B2B pelo WhatsApp", "5 e-mails profissionais", "Prioridade de suporte"],
  },
] as const;

const FAQ = [
  ["Tem comissão sobre as vendas?", "Não. A mensalidade é fixa: venda R$ 500 ou R$ 50 mil no mês, o valor é o mesmo. Plataformas grandes cobram plano mais tarifa por venda; aqui não."],
  ["O dinheiro passa pela Avila Ops?", "Não. Pix, cartão e boleto caem na conta Mercado Pago da sua empresa, na hora. A Avila Ops só cobra a mensalidade."],
  ["Quanto tempo leva para a loja entrar no ar?", "Um dia. Você preenche cinco etapas no estúdio; domínio, e-mail e loja sobem sozinhos. Os produtos entram um a um ou por planilha, e a gente cadastra o resto junto com você no setup."],
  ["Preciso entender de tecnologia?", "Não. O painel é o que a gente configura junto no setup. No dia a dia você só vê pedido chegar, separa e marca como enviado."],
  ["Posso usar meu próprio domínio?", "Sim, no plano Loja Pro. Nos outros, a loja fica em seunome.lojas.avilaops.com, com SSL e e-mail profissional."],
  ["E se eu cancelar?", "A loja sai do ar e você recebe os dados dos seus clientes e pedidos em planilha. Sem multa, sem fidelidade."],
] as const;

/** Marcas fictícias, criadas para mostrar a direção visual. Não são clientes. */
const EXEMPLOS_VISUAIS = [
  {
    segmento: "Confeitaria",
    marca: "Doce Brasa",
    produto: "Caixa presente",
    preco: "R$ 64",
    imagem: "/media/exemplo-confeitaria.webp",
    alt: "Vitrine de confeitaria com bolo de chocolate e brigadeiros",
    tema: "terracota",
  },
  {
    segmento: "Moda & acessórios",
    marca: "Norte Studio",
    produto: "Bolsa de couro",
    preco: "R$ 189",
    imagem: "/media/exemplo-moda.webp",
    alt: "Vitrine de moda com bolsa, óculos e peças em linho",
    tema: "cobalto",
  },
  {
    segmento: "Casa & feito à mão",
    marca: "Casa Serena",
    produto: "Coleção Origens",
    preco: "Ver coleção",
    imagem: "/media/exemplo-casa.webp",
    alt: "Vitrine de decoração artesanal com cerâmica, fibras e madeira",
    tema: "areia",
  },
] as const;

function MarcaLojas({ compacta = false }: { compacta?: boolean }) {
  return (
    <span className="pl-marca">
      <span className="pl-marca-simbolo" aria-hidden="true"><span /></span>
      <span className="pl-marca-texto">
        <strong>Lojas</strong>
        {!compacta && <small>por Avila Ops</small>}
      </span>
    </span>
  );
}

const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      name: "Lojas Avila Ops",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url: "https://lojas.avilaops.com",
      description: "Plataforma de loja virtual para o comércio de bairro: catálogo, carrinho, Pix na hora, cartão e boleto, frete por CEP, WhatsApp e e-mail profissional por mensalidade fixa, sem comissão sobre venda.",
      offers: PLANOS.map((p) => ({ "@type": "Offer", name: `Plano ${p.nome}`, price: p.preco, priceCurrency: "BRL", url: `https://lojas.avilaops.com/criar?plano=${p.id}`, description: p.descricao })),
      provider: { "@type": "Organization", name: "Avila Ops", url: "https://avilaops.com" },
    },
    {
      "@type": "FAQPage",
      mainEntity: FAQ.map(([pergunta, resposta]) => ({ "@type": "Question", name: pergunta, acceptedAnswer: { "@type": "Answer", text: resposta } })),
    },
  ],
};

export default function LandingPlataforma() {
  return (
    <div className="pl-site">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <div className="pl-ambiente" aria-hidden="true" />

      <section className="pl-hero">
        <div className="pl-container pl-hero-grid">
          <div className="pl-hero-copy">
            <div className="pl-eyebrow"><Sparkles size={14} /> Loja virtual para o comércio de bairro</div>
            <h1>Sua loja no ar em um dia.<br /><span>Pix na hora, sem comissão.</span></h1>
            <p>
              Catálogo, carrinho, Pix, cartão e boleto, frete por CEP, WhatsApp e e-mail profissional
              por <strong>R$ 119 fixos no mês</strong>. O dinheiro cai na conta da sua empresa, não na nossa.
            </p>
            <div className="pl-acoes">
              <Link href="/criar" className="pl-botao pl-botao-primario">
                Criar minha loja <ArrowRight size={17} />
              </Link>
              <a href="https://demo.lojas.avilaops.com" target="_blank" rel="noopener" className="pl-botao pl-botao-secundario">
                Ver uma loja de exemplo
              </a>
            </div>
            <div className="pl-provas" aria-label="O que está incluído">
              <span><Banknote size={15} /> Sem comissão sobre venda</span>
              <span><QrCode size={15} /> Pix na hora</span>
              <span><Clock3 size={15} /> No ar em um dia</span>
            </div>
          </div>

          <div className="pl-hero-visual">
            <div className="pl-orbita pl-orbita-a" aria-hidden="true" />
            <div className="pl-orbita pl-orbita-b" aria-hidden="true" />
            <Image
              src="/media/lojas-hero-commerce.webp"
              alt="Composição tridimensional de uma vitrine digital modular"
              width={1536}
              height={1024}
              priority
              sizes="(max-width: 900px) 100vw, 54vw"
            />
            <div className="pl-status pl-status-venda"><span><Check size={12} /></span><div><small>Pedido #1042</small><strong>Pix recebido: R$ 189,00</strong></div></div>
            <div className="pl-status pl-status-operacao"><MessageCircleMore size={17} /><div><small>WhatsApp</small><strong>Lojista avisado na hora</strong></div></div>
          </div>
        </div>
      </section>

      <div className="pl-faixa">
        <div className="pl-container">
          <span>Tudo dentro da mensalidade</span>
          <div><Store size={16} /> Catálogo</div><i />
          <div><QrCode size={16} /> Pix, cartão e boleto</div><i />
          <div><Truck size={16} /> Frete por CEP</div><i />
          <div><MessageCircleMore size={16} /> WhatsApp</div><i />
          <div><PackageCheck size={16} /> Pedido até a entrega</div>
        </div>
      </div>

      <section id="recursos" className="pl-secao pl-jornada">
        <div className="pl-container">
          <header className="pl-secao-cabecalho">
            <div><span className="pl-kicker">Como funciona</span><h2>Você cuida da loja.<br />A estrutura cuida do resto.</h2></div>
            <p>Quatro passos, sem reunião de tecnologia. Quem opera é quem já cuida do WhatsApp da loja.</p>
          </header>

          <div className="pl-linha-processo">
            <article><span>01</span><div className="pl-processo-icone"><Store /></div><h3>Conte sobre a sua loja</h3><p>Nome, WhatsApp, o que vende e para quem. Cinco etapas, uns dez minutos.</p><em>Estúdio de criação</em></article>
            <article><span>02</span><div className="pl-processo-icone"><Palette /></div><h3>Receba a loja pronta</h3><p>Cores, layout, domínio e e-mail sobem sozinhos. Os produtos entram um a um ou por planilha.</p><em>No ar no mesmo dia</em></article>
            <article><span>03</span><div className="pl-processo-icone"><QrCode /></div><h3>O cliente escolhe e paga</h3><p>Carrinho, frete pelo CEP e Pix na hora. Você recebe o aviso no WhatsApp com o pedido inteiro.</p><em>Dinheiro na sua conta</em></article>
            <article><span>04</span><div className="pl-processo-icone"><PackageCheck /></div><h3>Separe, envie, pronto</h3><p>Etiqueta, rastreio e e-mail para o cliente saem do painel. Carrinho abandonado e reposição avisam sozinhos.</p><em>Pós-venda automático</em></article>
          </div>
        </div>
      </section>

      <section className="pl-secao pl-exemplos">
        <div className="pl-container">
          <header className="pl-exemplos-cabecalho">
            <div>
              <span className="pl-kicker">Direções visuais</span>
              <h2>Um negócio.<br />Muitas formas de vender.</h2>
            </div>
            <Link href="/criar" className="pl-link">Quero ver a minha <ArrowRight size={16} /></Link>
          </header>

          <div className="pl-exemplos-grid">
            {EXEMPLOS_VISUAIS.map((exemplo, indice) => (
              <article key={exemplo.marca} className={`pl-exemplo pl-exemplo-${exemplo.tema}`}>
                <div className="pl-exemplo-imagem">
                  <Image
                    src={exemplo.imagem}
                    alt={exemplo.alt}
                    fill
                    sizes="(max-width: 700px) 92vw, (max-width: 1050px) 44vw, 33vw"
                  />
                  <div className="pl-exemplo-navegador" aria-hidden="true">
                    <span><i /><i /><i /></span>
                    <b>{exemplo.marca}</b>
                    <em>•••</em>
                  </div>
                  <div className="pl-exemplo-marca">
                    <span>{exemplo.segmento}</span>
                    <h3>{exemplo.marca}</h3>
                  </div>
                  <div className="pl-exemplo-produto">
                    <span><small>0{indice + 1}</small>{exemplo.produto}</span>
                    <strong>{exemplo.preco}</strong>
                  </div>
                </div>
                <p><BadgeCheck size={14} /> Marca fictícia, só para mostrar a direção visual</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="modelos" className="pl-secao pl-modelos">
        <div className="pl-container">
          <header className="pl-secao-cabecalho">
            <div><span className="pl-kicker">Sete layouts prontos</span><h2>Não parece um template.<br />Parece a sua marca.</h2></div>
            <p>Escolha a composição que combina com o seu catálogo. Cores, fontes e fotos assumem a personalidade da loja; dá para trocar depois no painel.</p>
          </header>
          <ModelosInterativos />
          <div className="pl-modelos-rodape">
            <p><Palette size={18} /> <strong>Identidade da sua loja</strong><span>Paleta, tipografia, cantos, fotos e composição.</span></p>
            <p><Zap size={18} /> <strong>Rápida no celular</strong><span>É onde o seu cliente compra.</span></p>
            <p><Store size={18} /> <strong>Feita para vender</strong><span>Do catálogo ao Pix, sem perder a personalidade.</span></p>
          </div>
        </div>
      </section>

      <section id="planos" className="pl-secao pl-planos">
        <div className="pl-container">
          <header className="pl-planos-cabecalho">
            <span className="pl-kicker">Três planos, preço fixo</span>
            <h2>Sem comissão. Sem dólar. Sem surpresa.</h2>
            <p>Setup único de <strong>R$ 497</strong> · 14 dias de teste · a mensalidade começa no dia em que a loja entra no ar.</p>
          </header>
          <div className="pl-planos-grid">
            {PLANOS.map((plano) => (
              <article key={plano.id} className={plano.destaque ? "pl-plano pl-plano-destaque" : "pl-plano"}>
                <div className="pl-plano-topo">
                  <span>{plano.rotulo}</span>
                  {plano.destaque && <b><Sparkles size={12} /> Mais escolhido</b>}
                </div>
                <h3>{plano.nome}</h3>
                <p>{plano.descricao}</p>
                <div className="pl-preco"><small>R$</small><strong>{plano.preco}</strong><span>/mês</span></div>
                <Link href={`/criar?plano=${plano.id}`} className={plano.destaque ? "pl-botao pl-botao-primario" : "pl-botao pl-botao-plano"}>
                  Escolher {plano.nome} <ChevronRight size={16} />
                </Link>
                <ul>{plano.itens.map((item) => <li key={item}><Check size={15} /> {item}</li>)}</ul>
              </article>
            ))}
          </div>
          <p className="pl-planos-nota"><ShieldCheck size={15} /> Pix, cartão e boleto pelo Mercado Pago, na conta da sua empresa. O dinheiro não passa pela Avila Ops.</p>
        </div>
      </section>

      <section className="pl-secao pl-faq">
        <div className="pl-container pl-faq-grid">
          <div><span className="pl-kicker">Dúvidas comuns</span><h2>Sem letras miúdas.<br />Sem complicação.</h2><p>Se a sua operação tiver uma necessidade específica, a gente combina antes de publicar. Fora do padrão é projeto à parte, e isso fica claro desde o começo.</p></div>
          <div className="pl-faq-lista">
            {FAQ.map(([pergunta, resposta], indice) => (
              <details key={pergunta} open={indice === 0}><summary>{pergunta}<span>+</span></summary><p>{resposta}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="pl-cta-final">
        <div className="pl-container pl-cta-grid">
          <div className="pl-cta-glow" aria-hidden="true" />
          <div className="pl-cta-copy"><MarcaLojas /><h2>Sua próxima venda pode ser hoje.</h2><p>Dez minutos no estúdio, a loja no ar no mesmo dia e o próximo Pix caindo na sua conta.</p><Link href="/criar" className="pl-botao pl-botao-claro">Criar minha loja <ArrowRight size={17} /></Link></div>
          <div className="pl-cta-painel" aria-label="Resumo">
            <span>O que você leva</span><strong>Uma loja pronta para vender.</strong>
            <div><p><b>R$ 119</b><small>fixos por mês</small></p><p><b>0%</b><small>de comissão</small></p><p><b>1 dia</b><small>para entrar no ar</small></p></div>
            <em><Check size={14} /> Catálogo, Pix, frete, WhatsApp e e-mail no mesmo lugar</em>
          </div>
        </div>
      </section>
    </div>
  );
}
