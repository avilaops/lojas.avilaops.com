import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Bot,
  Check,
  ChevronRight,
  Cloud,
  CreditCard,
  Globe2,
  Layers3,
  MessageCircleMore,
  PackageCheck,
  Palette,
  ShieldCheck,
  Sparkles,
  Store,
  WandSparkles,
  Zap,
} from "lucide-react";
import ModelosInterativos from "@/components/plataforma/ModelosInterativos";

export const metadata: Metadata = {
  title: "Lojas Avila Ops — sua loja pronta para vender",
  description:
    "Loja virtual com identidade própria, domínio, checkout, frete e automações. Tecnologia e operação reunidas para sua empresa vender melhor.",
  alternates: { canonical: "https://lojas.avilaops.com" },
  openGraph: {
    title: "Lojas Avila Ops — sua loja pronta para vender",
    description: "Uma presença digital sofisticada, com tecnologia que trabalha junto com você.",
    url: "https://lojas.avilaops.com",
    siteName: "Lojas Avila Ops",
    locale: "pt_BR",
    type: "website",
    images: [{ url: "/plataforma/opengraph-image", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Lojas Avila Ops — sua loja pronta para vender",
    description: "Design, vendas e automação em uma única operação.",
    images: ["/plataforma/opengraph-image"],
  },
};

const PLANOS = [
  {
    id: "SITE",
    nome: "Essencial",
    rotulo: "Para começar",
    preco: 79,
    descricao: "Uma presença profissional que transforma visitas em conversas.",
    destaque: false,
    itens: ["Vitrine responsiva", "Pedidos pelo WhatsApp", "Domínio, SSL e hospedagem", "1 e-mail profissional", "Painel e treinamento"],
  },
  {
    id: "LOJA",
    nome: "Negócio",
    rotulo: "O plano inteligente",
    preco: 119,
    destaque: true,
    descricao: "A operação completa para vender e receber sem depender de plataformas genéricas.",
    itens: ["Tudo do Essencial", "Carrinho e checkout próprio", "PIX, cartão e boleto", "Frete por CEP e retirada", "Avisos de venda no WhatsApp"],
  },
  {
    id: "LOJA_PRO",
    nome: "Escala",
    rotulo: "Para crescer",
    preco: 349,
    descricao: "Automação e inteligência para vender mais com menos trabalho manual.",
    destaque: false,
    itens: ["Tudo do Negócio", "Carrinho abandonado e pós-venda", "Cupons e alertas de estoque", "Relatório executivo semanal", "5 e-mails e apoio à NF-e"],
  },
] as const;

const FAQ = [
  ["Preciso entender de tecnologia?", "Não. Você informa os dados do negócio e acompanha tudo por um painel simples. Configuração, publicação e orientação fazem parte da jornada."],
  ["Posso usar meu próprio domínio?", "Sim. Configuramos domínio, SSL e os registros de e-mail com o padrão operacional da Avila Ops."],
  ["O dinheiro passa pela Avila Ops?", "Não. A conta de recebimento pertence à sua empresa. O Mercado Pago já está integrado; PayPal e Éfi são as próximas integrações previstas para completar as três opções da Avila Ops."],
  ["Consigo trocar cores, fontes e layout?", "Sim. Você escolhe a direção visual e um dos layouts profissionais. O sistema mantém a experiência consistente no celular e no computador."],
] as const;

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
    produto: "Bolsa Essencial",
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

export default function LandingPlataforma() {
  return (
    <div className="pl-site">
      <div className="pl-ambiente" aria-hidden="true" />

      <section className="pl-hero">
        <div className="pl-container pl-hero-grid">
          <div className="pl-hero-copy">
            <div className="pl-eyebrow"><Sparkles size={14} /> Comércio digital, com identidade</div>
            <h1>Sua loja começa <span>bonita.</span><br />E cresce pronta.</h1>
            <p>
              Design sofisticado, checkout próprio e automações que trabalham nos bastidores.
              Tudo o que sua empresa precisa para vender online — sem montar um quebra-cabeça de ferramentas.
            </p>
            <div className="pl-acoes">
              <Link href="/criar" className="pl-botao pl-botao-primario">
                Criar minha loja <ArrowRight size={17} />
              </Link>
              <a href="https://demo.lojas.avilaops.com" target="_blank" rel="noopener" className="pl-botao pl-botao-secundario">
                Explorar uma loja
              </a>
            </div>
            <div className="pl-provas" aria-label="Benefícios incluídos">
              <span><BadgeCheck size={15} /> Domínio próprio</span>
              <span><ShieldCheck size={15} /> SSL e LGPD</span>
              <span><Zap size={15} /> Publicação rápida</span>
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
            <div className="pl-status pl-status-venda"><span><Check size={12} /></span><div><small>Nova venda</small><strong>Pagamento confirmado</strong></div></div>
            <div className="pl-status pl-status-operacao"><Bot size={17} /><div><small>Automação ativa</small><strong>Pós-venda programado</strong></div></div>
          </div>
        </div>
      </section>

      <div className="pl-faixa">
        <div className="pl-container">
          <span>Uma operação, do primeiro clique ao pós-venda</span>
          <div><Globe2 size={16} /> Domínio</div><i />
          <div><Palette size={16} /> Identidade</div><i />
          <div><CreditCard size={16} /> Pagamento</div><i />
          <div><PackageCheck size={16} /> Entrega</div><i />
          <div><MessageCircleMore size={16} /> Relacionamento</div>
        </div>
      </div>

      <section id="recursos" className="pl-secao pl-jornada">
        <div className="pl-container">
          <header className="pl-secao-cabecalho">
            <div><span className="pl-kicker">Da ideia à operação</span><h2>Você cuida do negócio.<br />A estrutura cuida do resto.</h2></div>
            <p>Uma jornada guiada transforma suas escolhas em uma operação pronta para vender.</p>
          </header>

          <div className="pl-linha-processo">
            <article><span>01</span><div className="pl-processo-icone"><WandSparkles /></div><h3>Conte o que quer construir</h3><p>Responda cinco etapas guiadas.</p><em>Diagnóstico de marca</em></article>
            <article><span>02</span><div className="pl-processo-icone"><Layers3 /></div><h3>Receba uma presença completa</h3><p>Identidade, catálogo e checkout juntos.</p><em>Publicação integrada</em></article>
            <article><span>03</span><div className="pl-processo-icone"><Bot /></div><h3>Venda no automático</h3><p>Venda, estoque e pós-venda conectados.</p><em>Rotinas conectadas</em></article>
            <article><span>04</span><div className="pl-processo-icone"><BarChart3 /></div><h3>Aprenda e cresça</h3><p>Relatórios claros para decidir melhor.</p><em>Evolução contínua</em></article>
          </div>
        </div>
      </section>

      <section className="pl-secao pl-exemplos">
        <div className="pl-container">
          <header className="pl-exemplos-cabecalho">
            <div>
              <span className="pl-kicker">Exemplos visuais</span>
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
                <p><BadgeCheck size={14} /> Exemplo de identidade aplicada</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="pl-secao pl-demo">
        <div className="pl-container">
          <header className="pl-secao-cabecalho">
            <div><span className="pl-kicker">Demonstração real</span><h2>Veja uma marca nascer.<br />Sem configuração complicada.</h2></div>
            <p>Este é o fluxo funcionando de verdade: o cliente descreve o negócio, recebe uma direção visual e revisa a estrutura antes de publicar.</p>
          </header>
          <div className="pl-demo-frame">
            <div className="pl-demo-bar"><span><i /><i /><i /></span><strong>Estúdio de lançamento</strong><em>Fluxo real</em></div>
            <video controls autoPlay muted loop playsInline preload="metadata" poster="/media/demo-criacao-loja-poster.png" aria-label="Demonstração do processo de criação de uma loja">
              <source src="/media/demo-criacao-loja.webm" type="video/webm" />
              Seu navegador não suporta vídeo. <Link href="/criar">Experimente o fluxo de criação</Link>.
            </video>
          </div>
          <div className="pl-demo-legenda"><span><b>01</b> Informações claras</span><span><b>02</b> Direção visual imediata</span><span><b>03</b> Revisão antes de publicar</span></div>
        </div>
      </section>

      <section id="modelos" className="pl-secao pl-modelos">
        <div className="pl-container">
          <header className="pl-secao-cabecalho">
            <div><span className="pl-kicker">Layouts com direção de arte</span><h2>Não parece um template.<br />Parece a sua marca.</h2></div>
            <p>Escolha uma composição criada para o seu tipo de catálogo. Cores, fontes, imagens e conteúdo assumem a personalidade do negócio.</p>
          </header>
          <ModelosInterativos />
          <div className="pl-modelos-rodape">
            <p><Palette size={18} /> <strong>Identidade flexível</strong><span>Paleta, tipografia, cantos, imagens e composição.</span></p>
            <p><Zap size={18} /> <strong>Experiência consistente</strong><span>Rápida e responsiva em qualquer tamanho de tela.</span></p>
            <p><Store size={18} /> <strong>Feita para comércio</strong><span>Do catálogo ao checkout, sem perder a personalidade.</span></p>
          </div>
        </div>
      </section>

      <section className="pl-secao pl-tecnologia">
        <div className="pl-container pl-tecnologia-grid">
          <div className="pl-tecnologia-copy">
            <span className="pl-kicker">Tecnologia que não aparece. Resultado que aparece.</span>
            <h2>Mais que uma página bonita.</h2>
            <p>Construímos a camada visual e a operação como um produto único. Isso reduz dependências, preserva velocidade e deixa espaço para sua empresa crescer.</p>
            <Link href="/criar" className="pl-link">Começar meu projeto <ArrowRight size={16} /></Link>
          </div>
          <div className="pl-matriz">
            <article><Cloud /><span>Infraestrutura</span><strong>Cloudflare + servidor próprio</strong><small>DNS, SSL, proteção e disponibilidade.</small></article>
            <article><Bot /><span>Automação</span><strong>n8n conectado à operação</strong><small>Eventos de venda viram ações sem trabalho repetitivo.</small></article>
            <article><MessageCircleMore /><span>Relacionamento</span><strong>WhatsApp com contexto</strong><small>Avisos e jornadas conectados ao momento do cliente.</small></article>
            <article><ShieldCheck /><span>Controle</span><strong>Dados e identidade próprios</strong><small>Sua marca na frente; integrações nos bastidores.</small></article>
          </div>
        </div>
      </section>

      <section id="planos" className="pl-secao pl-planos">
        <div className="pl-container">
          <header className="pl-planos-cabecalho">
            <span className="pl-kicker">Planos claros, evolução contínua</span>
            <h2>Comece certo. Cresça sem recomeçar.</h2>
            <p>Implantação a partir de <strong>R$ 497</strong> (12x de R$ 49,70). Mercado Pago ativo; PayPal e Éfi em implantação.</p>
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
          <p className="pl-planos-nota"><ShieldCheck size={15} /> Pagamentos pela conta da sua empresa. Mercado Pago está integrado; PayPal e Éfi permanecem identificados como próximos gateways, sem promessa de disponibilidade antecipada.</p>
        </div>
      </section>

      <section className="pl-secao pl-faq">
        <div className="pl-container pl-faq-grid">
          <div><span className="pl-kicker">Dúvidas comuns</span><h2>Sem letras miúdas.<br />Sem complicação.</h2><p>Se sua operação tiver uma necessidade específica, desenhamos a melhor jornada antes de publicar.</p></div>
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
          <div className="pl-cta-copy"><MarcaLojas /><h2>Sua próxima venda pode começar aqui.</h2><p>Crie a estrutura da sua loja agora e transforme sua presença digital em uma operação de verdade.</p><Link href="/criar" className="pl-botao pl-botao-claro">Criar minha loja <ArrowRight size={17} /></Link></div>
          <div className="pl-cta-painel" aria-label="Resumo do lançamento">
            <span>Seu lançamento</span><strong>Uma marca pronta para operar.</strong>
            <div><p><b>05</b><small>etapas guiadas</small></p><p><b>04</b><small>layouts profissionais</small></p><p><b>01</b><small>operação integrada</small></p></div>
            <em><Check size={14} /> Identidade, vitrine e automação no mesmo fluxo</em>
          </div>
        </div>
      </section>
    </div>
  );
}
