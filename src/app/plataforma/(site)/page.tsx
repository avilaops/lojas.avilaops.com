import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  Banknote,
  Check,
  ChevronRight,
  Clock3,
  MessageCircleMore,
  PackageCheck,
  QrCode,
  ShieldCheck,
  Store,
  Truck,
} from "lucide-react";
import ModelosInterativos from "@/components/plataforma/ModelosInterativos";
import { PLANOS } from "@/lib/planos";

export const metadata: Metadata = {
  // `absolute`: o template do layout acrescentaria "· Lojas Avila Ops" de novo.
  title: { absolute: "Lojas Avila Ops | a loja virtual com a cara do seu negócio" },
  description:
    "Sua marca, suas cores, suas fotos: loja virtual pronta em um dia, com Pix na hora, frete por CEP, WhatsApp e e-mail profissional por R$ 269 fixos no mês. O dinheiro cai na conta da sua empresa.",
  alternates: { canonical: "https://lojas.avilaops.com" },
  openGraph: {
    title: "Lojas Avila Ops | a loja virtual com a cara do seu negócio",
    description: "Sua marca, suas cores, suas fotos. R$ 269 fixos no mês, sem comissão.",
    url: "https://lojas.avilaops.com",
    siteName: "Lojas Avila Ops",
    locale: "pt_BR",
    type: "website",
    images: [{ url: "/plataforma/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lojas Avila Ops | a loja virtual com a cara do seu negócio",
    description: "Sua marca, suas cores, suas fotos. R$ 269 fixos no mês, sem comissão.",
    images: ["/plataforma/opengraph-image"],
  },
};


const FAQ = [
  ["Tem comissão sobre as vendas?", "Não. A mensalidade é fixa: venda R$ 500 ou R$ 50 mil no mês, o valor é o mesmo. Plataformas grandes cobram plano mais tarifa por venda; aqui não."],
  ["O dinheiro passa pela Avila Ops?", "Não. Pix, cartão e boleto caem na conta da sua empresa, na hora. A gente só cobra a mensalidade."],
  ["A loja fica com a minha cara ou com a de vocês?", "Com a sua. Cor, letra, fotos e o jeito de mostrar os produtos saem do seu negócio. O nome da Avila Ops aparece numa linha discreta no rodapé, só isso."],
  ["Quanto tempo leva para entrar no ar?", "Um dia. Você conta como é o seu negócio em cinco etapas, e domínio, e-mail e loja sobem sozinhos. Os produtos entram um a um ou por planilha, e no setup a gente cadastra junto com você."],
  ["Preciso entender de tecnologia?", "Não. No dia a dia você vê o pedido chegar, separa e marca como enviado. O resto já vai pronto."],
  ["E se eu cancelar?", "A loja sai do ar e você recebe os dados dos seus clientes e pedidos em planilha. Sem multa, sem fidelidade."],
] as const;

/**
 * Cenas da página: cada uma é um negócio diferente, com a cor, a letra e a foto
 * daquele negócio. É o argumento inteiro da página (a loja tem a cara do
 * cliente, não a nossa) e por isso o site troca de atmosfera enquanto se rola.
 *
 * Marcas fictícias, criadas para mostrar direção visual. Nenhuma é cliente.
 */
const CENAS = [
  {
    id: "confeitaria",
    tom: "terracota",
    segmento: "Confeitaria",
    marca: "Doce Brasa",
    frase: "Encomenda de bolo não cabe num catálogo de PDF.",
    texto:
      "A vitrine puxa o marrom do chocolate, a letra tem serifa de convite e a foto ocupa a tela inteira. Quem abre no celular vê doce, não formulário.",
    detalhe: ["Caixa presente", "R$ 64"],
    imagem: "/media/exemplo-confeitaria.webp",
    alt: "Vitrine de confeitaria com bolo de chocolate e brigadeiros",
    ganho: "Encomenda com data e recheio escolhidos, paga no Pix antes de sair da conversa.",
  },
  {
    id: "moda",
    tom: "cobalto",
    segmento: "Moda e acessórios",
    marca: "Norte Studio",
    frase: "Roupa vende pela foto e pelo tamanho certo.",
    texto:
      "Fundo limpo, uma cor forte de assinatura e a grade de tamanho e cor que o cliente escolhe sozinho. Esgotou um número, ele some do carrinho na hora.",
    detalhe: ["Bolsa de couro", "R$ 189"],
    imagem: "/media/exemplo-moda.webp",
    alt: "Vitrine de moda com bolsa, óculos e peças em linho",
    ganho: "Tamanho e cor resolvidos na tela, no lugar de trinta mensagens perguntando se tem P.",
  },
  {
    id: "casa",
    tom: "areia",
    segmento: "Casa e feito à mão",
    marca: "Casa Serena",
    frase: "Peça artesanal precisa de história, não de tabela.",
    texto:
      "Tom de areia, tipografia calma e espaço em volta de cada peça. A descrição longa cabe inteira, e a coleção ganha página própria.",
    detalhe: ["Coleção Origens", "Ver coleção"],
    imagem: "/media/exemplo-casa.webp",
    alt: "Vitrine de decoração artesanal com cerâmica, fibras e madeira",
    ganho: "A peça chega ao cliente com a história junto e com o frete já calculado.",
  },
] as const;

const OFICIOS = [
  {
    tom: "grafite",
    segmento: "Motopeças e oficina",
    marca: "Sandro Motos",
    frase: "O cliente escolhe a moto e só vê o que serve nela.",
    itens: ["Garagem por marca, modelo e ano", "Código original e equivalentes", "Selo \"serve na sua moto\""],
  },
  {
    tom: "verde",
    segmento: "Pet e agropecuária",
    marca: "Casa Bicho",
    frase: "Ração de 15 kg com frete certo e cliente que repete.",
    itens: ["Peso real no cálculo do frete", "Avise-me quando chegar", "Recompra em dois toques"],
  },
  {
    tom: "ameixa",
    segmento: "Cosméticos e beleza",
    marca: "Ateliê Lis",
    frase: "Kit montado, brinde e cupom que fazem o carrinho subir.",
    itens: ["Kits e combos", "Cupom de primeira compra", "\"Leve também\" no carrinho"],
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
      "@type": "Service",
      name: "Lojas Avila Ops",
      serviceType: "Loja virtual para comércio local",
      areaServed: "BR",
      url: "https://lojas.avilaops.com",
      description:
        "Loja virtual com a identidade do próprio comércio: catálogo, carrinho, Pix na hora, cartão e boleto, frete por CEP, WhatsApp e e-mail profissional por mensalidade fixa, sem comissão sobre venda.",
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
    <div className="pl-site pl-site-claro">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />

      <section className="pl-abertura">
        <div className="pl-container pl-abertura-grid">
          <div className="pl-abertura-copy">
            <span className="pl-selo">Loja virtual para o comércio de bairro</span>
            <h1>A loja com a cara<br />do <span>seu</span> negócio.</h1>
            <p>
              Sua cor, sua letra, suas fotos, e o cliente comprando pelo celular sem
              perguntar preço. No ar em um dia por <strong>R$ 269 fixos no mês</strong>,
              com o dinheiro caindo na conta da sua empresa.
            </p>
            <div className="pl-acoes">
              <Link href="/criar" className="pl-botao pl-botao-primario">Criar minha loja <ArrowRight size={17} /></Link>
              <a href="https://demo.lojas.avilaops.com" target="_blank" rel="noopener" className="pl-botao pl-botao-linha">Ver uma loja pronta</a>
            </div>
            <ul className="pl-provas">
              <li><Banknote size={15} /> Sem comissão sobre venda</li>
              <li><QrCode size={15} /> Pix na hora</li>
              <li><Clock3 size={15} /> No ar em um dia</li>
            </ul>
          </div>

          <div className="pl-abertura-mosaico" aria-hidden="true">
            <figure className="pl-mosaico-item pl-tom-terracota">
              <Image src="/media/exemplo-confeitaria.webp" alt="" width={420} height={520} sizes="(max-width: 900px) 44vw, 250px" />
              <figcaption><small>Confeitaria</small><strong>Doce Brasa</strong></figcaption>
            </figure>
            <figure className="pl-mosaico-item pl-tom-cobalto">
              <Image src="/media/exemplo-moda.webp" alt="" width={420} height={520} sizes="(max-width: 900px) 44vw, 250px" />
              <figcaption><small>Moda</small><strong>Norte Studio</strong></figcaption>
            </figure>
            <figure className="pl-mosaico-item pl-tom-areia">
              <Image src="/media/exemplo-casa.webp" alt="" width={420} height={520} sizes="(max-width: 900px) 44vw, 250px" />
              <figcaption><small>Casa</small><strong>Casa Serena</strong></figcaption>
            </figure>
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

      {CENAS.map((cena, indice) => (
        <section key={cena.id} className={`pl-cena pl-tom-${cena.tom}${indice % 2 ? " pl-cena-invertida" : ""}`}>
          <div className="pl-container pl-cena-grid">
            <div className="pl-cena-texto">
              <span className="pl-cena-segmento">{cena.segmento}</span>
              <h2>{cena.frase}</h2>
              <p>{cena.texto}</p>
              <p className="pl-cena-ganho"><Check size={16} /> {cena.ganho}</p>
              <span className="pl-cena-ficticia">{cena.marca} é uma marca fictícia, criada só para mostrar a direção visual.</span>
            </div>
            <figure className="pl-cena-arte">
              <Image src={cena.imagem} alt={cena.alt} fill sizes="(max-width: 900px) 92vw, 46vw" />
              <div className="pl-cena-marca">
                <small>{cena.segmento}</small>
                <strong>{cena.marca}</strong>
              </div>
              <div className="pl-cena-produto">
                <span>{cena.detalhe[0]}</span>
                <b>{cena.detalhe[1]}</b>
              </div>
            </figure>
          </div>
        </section>
      ))}

      <section className="pl-oficios">
        <div className="pl-container">
          <header className="pl-cabecalho">
            <span className="pl-kicker">Cada ramo vende de um jeito</span>
            <h2>A loja se molda ao que você vende.</h2>
            <p>Não é o mesmo modelo pintado de outra cor: muda o jeito de escolher, de calcular o frete e de fechar o pedido.</p>
          </header>
          <div className="pl-oficios-grid">
            {OFICIOS.map((oficio) => (
              <article key={oficio.marca} className={`pl-oficio pl-tom-${oficio.tom}`}>
                <span className="pl-oficio-segmento">{oficio.segmento}</span>
                <strong className="pl-oficio-marca">{oficio.marca}</strong>
                <p>{oficio.frase}</p>
                <ul>{oficio.itens.map((item) => <li key={item}><Check size={14} /> {item}</li>)}</ul>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="modelos" className="pl-modelos">
        <div className="pl-container">
          <header className="pl-cabecalho pl-cabecalho-escuro">
            <span className="pl-kicker">Nove jeitos de mostrar a vitrine</span>
            <h2>Escolha a composição.<br />A cor e as fotos são suas.</h2>
            <p>Toque para ver como fica cada uma. Dá para trocar depois, quantas vezes quiser, sem refazer nada.</p>
          </header>
          <ModelosInterativos />
        </div>
      </section>

      <section id="recursos" className="pl-passos">
        <div className="pl-container">
          <header className="pl-cabecalho">
            <span className="pl-kicker">Como funciona</span>
            <h2>Você cuida da loja.<br />O resto anda sozinho.</h2>
            <p>Quatro passos. Quem opera é quem já cuida do WhatsApp do balcão.</p>
          </header>
          <ol className="pl-passos-lista">
            <li><span>01</span><h3>Conte como é o seu negócio</h3><p>Nome, WhatsApp, o que vende e para quem. Uns dez minutos.</p></li>
            <li><span>02</span><h3>Receba a loja com a sua cara</h3><p>Cores, letras e endereço prontos. Os produtos entram um a um ou por planilha.</p></li>
            <li><span>03</span><h3>O cliente escolhe e paga</h3><p>Carrinho, frete pelo CEP e Pix na hora. Você recebe o aviso no WhatsApp.</p></li>
            <li><span>04</span><h3>Separe, envie, pronto</h3><p>Etiqueta e rastreio saem do painel. O cliente acompanha sem precisar te perguntar.</p></li>
          </ol>
        </div>
      </section>

      <section id="planos" className="pl-planos">
        <div className="pl-container">
          <header className="pl-cabecalho pl-planos-cabecalho">
            <span className="pl-kicker">Três planos, preço fixo</span>
            <h2>Sem comissão. Sem dólar. Sem surpresa.</h2>
            <p>Setup único de <strong>R$ 497</strong> · 7 dias de teste, sem cartão · a mensalidade começa quando você ativa a cobrança.</p>
          </header>
          <div className="pl-planos-grid">
            {PLANOS.map((plano) => (
              <article key={plano.id} className={plano.destaque ? "pl-plano pl-plano-destaque" : "pl-plano"}>
                <div className="pl-plano-topo">
                  <span>{plano.rotulo}</span>
                  {plano.destaque && <b>Mais escolhido</b>}
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
          <p className="pl-planos-nota"><ShieldCheck size={15} /> Pix, cartão e boleto caem na conta da sua empresa. O dinheiro não passa pela Avila Ops.</p>
        </div>
      </section>

      <section className="pl-faq">
        <div className="pl-container pl-faq-grid">
          <div>
            <span className="pl-kicker">Dúvidas comuns</span>
            <h2>Sem letras miúdas.</h2>
            <p>Se a sua operação tiver uma necessidade específica, a gente combina antes de publicar.</p>
          </div>
          <div className="pl-faq-lista">
            {FAQ.map(([pergunta, resposta], indice) => (
              <details key={pergunta} open={indice === 0}><summary>{pergunta}<span>+</span></summary><p>{resposta}</p></details>
            ))}
          </div>
        </div>
      </section>

      <section className="pl-fechamento">
        <div className="pl-container pl-fechamento-grid">
          <div className="pl-fechamento-copy">
            <MarcaLojas />
            <h2>Sua próxima venda<br />pode ser hoje.</h2>
            <p>Dez minutos contando como é o seu negócio, a loja no ar no mesmo dia e o próximo Pix caindo na sua conta.</p>
            <Link href="/criar" className="pl-botao pl-botao-claro">Criar minha loja <ArrowRight size={17} /></Link>
          </div>
          <dl className="pl-fechamento-numeros">
            <div><dt>R$ 269</dt><dd>fixos por mês</dd></div>
            <div><dt>0%</dt><dd>de comissão</dd></div>
            <div><dt>1 dia</dt><dd>para entrar no ar</dd></div>
          </dl>
        </div>
      </section>
    </div>
  );
}
