import type { Metadata } from "next";
import { Check, Download, X } from "lucide-react";
import { LogoLojas, SimboloLojas } from "@/components/marca/MarcaLojas";

export const metadata: Metadata = {
  title: "Marca: logo, símbolo, cores e uso",
  description:
    "A marca Lojas por Avila Ops: símbolo, logotipo, cores, letras e como ela aparece no site, no painel e nas lojas dos clientes. Arquivos para baixar.",
  alternates: { canonical: "https://lojas.avilaops.com/marca" },
};

/**
 * Manual da marca, em página. Os valores saem de marca-lojas.css e os
 * desenhos do mesmo componente que o cabeçalho usa: se a marca mudar, esta
 * página muda junto e não fica um PDF velho circulando.
 * O texto completo, com o porquê de cada regra, está em docs/MARCA-LOJAS.md.
 */
const CORES = [
  { grupo: "Página", itens: [
    { nome: "Tinta", hex: "#16130F", uso: "Texto, botão principal, fundo do painel e da cena escura." },
    { nome: "Papel", hex: "#FBF8F4", uso: "Fundo do site. Um branco quente, que não parece sistema." },
    { nome: "Papel 2", hex: "#F3EFE8", uso: "Faixas alternadas e rodapé." },
    { nome: "Linha", hex: "#E6DFD4", uso: "Bordas e divisórias." },
    { nome: "Tinta suave", hex: "#6A6259", uso: "Texto de apoio. Contraste 5,7:1 sobre o papel." },
  ] },
  { grupo: "Toldo", itens: [
    { nome: "Azul", hex: "#0153FD", uso: "Faixa do toldo e cor de interação: link, foco, seleção." },
    { nome: "Vermelho", hex: "#F72927", uso: "Faixa do toldo e pingo do j. Não é cor de erro." },
    { nome: "Amarelo", hex: "#FDC403", uso: "Faixa do toldo. Nunca em texto sobre fundo claro." },
  ] },
] as const;

const APLICACOES = [
  {
    titulo: "Site e estúdio",
    onde: "lojas.avilaops.com, /criar, /ajuda, /blog",
    regra: "Papel e tinta fazem a página; a cor vem dos negócios mostrados em cada cena. O logo completo, com o endosso \"por Avila Ops\", fica no cabeçalho e no rodapé.",
    classe: "mc-app-site",
  },
  {
    titulo: "Painel do lojista",
    onde: "/painel",
    regra: "Lateral na tinta, área de trabalho clara. O topo é da loja do lojista (nome e inicial); a plataforma assina embaixo, em uma cor. Azul só onde se clica.",
    classe: "mc-app-painel",
  },
  {
    titulo: "Loja do cliente",
    onde: "domínio do lojista e checkout",
    regra: "A marca é a do lojista, inteira: cor, letra, logo e favicon saem do tema dele. Lojas aparece uma vez, no selo monocromático do rodapé.",
    classe: "mc-app-loja",
  },
] as const;

const FACA = [
  "Usar o logo sobre papel, branco ou tinta, sempre com a área de respiro (a largura de uma faixa do toldo em volta).",
  "Usar o símbolo sozinho onde não cabe a palavra: ícone do aplicativo, favicon, avatar de rede social.",
  "Usar a versão monocromática dentro de loja de cliente e sobre foto.",
  "Deixar a cor da página para o negócio do lojista.",
];

const NAO_FACA = [
  "Trocar a ordem ou as cores do toldo, ou pintar o toldo com a cor de um cliente.",
  "Escrever \"lojas\" digitado em outra letra no lugar do logotipo desenhado.",
  "Usar azul, vermelho ou amarelo como fundo de seção inteira.",
  "Pôr a marca Lojas maior que a marca do lojista em qualquer tela da loja dele.",
];

const ARQUIVOS = [
  { nome: "Logotipo", arquivo: "lojas-logo.svg", png: "lojas-logo.png" },
  { nome: "Logotipo negativo", arquivo: "lojas-logo-negativo.svg", png: "lojas-logo-negativo.png" },
  { nome: "Símbolo", arquivo: "lojas-simbolo.svg", png: "lojas-simbolo.png" },
  { nome: "Símbolo monocromático", arquivo: "lojas-simbolo-mono.svg" },
  { nome: "Palavra", arquivo: "lojas-palavra.svg" },
  { nome: "Ícone do aplicativo", arquivo: "lojas-icone-app.svg" },
] as const;

export default function MarcaPage() {
  return (
    <div className="pl-site pl-site-claro mc">
      <section className="mc-abertura">
        <div className="pl-container">
          <span className="pl-kicker">Marca</span>
          <h1>Um toldo para cada negócio.</h1>
          <p>
            Toda loja de rua tem o seu toldo. O da Lojas tem as três cores da Avila Ops, e a
            porta fica aberta embaixo dele. O resto da página é de quem vende: a plataforma
            cede a cor, a letra e a vitrine para a marca do lojista.
          </p>
          <div className="mc-faixa" aria-hidden="true"><span /><span /><span /></div>
        </div>
      </section>

      <section className="mc-secao">
        <div className="pl-container mc-logos">
          <figure className="mc-palco mc-palco-papel">
            <LogoLojas className="mc-logo-grande" />
            <figcaption>Logotipo · sobre papel</figcaption>
          </figure>
          <figure className="mc-palco mc-palco-tinta">
            <LogoLojas className="mc-logo-grande" />
            <figcaption>Negativo · sobre tinta</figcaption>
          </figure>
          <figure className="mc-palco mc-palco-papel">
            <SimboloLojas className="mc-simbolo" titulo="Símbolo Lojas" />
            <figcaption>Símbolo</figcaption>
          </figure>
          <figure className="mc-palco mc-palco-foto">
            <SimboloLojas mono className="mc-simbolo" titulo="Símbolo Lojas monocromático" />
            <figcaption>Monocromático · loja de cliente e foto</figcaption>
          </figure>
        </div>
      </section>

      <section className="mc-secao mc-secao-alt">
        <div className="pl-container mc-duas">
          <div>
            <span className="pl-kicker">Construção</span>
            <h2>Três faixas, uma fachada, uma porta.</h2>
            <ul className="mc-lista">
              <li><b>Toldo.</b> Azul, vermelho e amarelo, nessa ordem: as cores do símbolo da Avila Ops. É o que liga a Lojas à casa.</li>
              <li><b>Fachada.</b> Um traço só, da mesma espessura das letras. Funciona a 16 px na aba do navegador.</li>
              <li><b>Porta em arco.</b> Aberta, sem vidro nem grade: a loja está funcionando.</li>
              <li><b>Palavra.</b> &ldquo;lojas&rdquo; em minúsculas, desenhada em traço redondo, sem fonte por trás. O pingo do j é o vermelho do toldo.</li>
            </ul>
          </div>
          <figure className="mc-grade">
            <SimboloLojas className="mc-simbolo" />
            <figcaption>Grade de 64 × 64, traço de 6</figcaption>
          </figure>
        </div>
      </section>

      <section className="mc-secao">
        <div className="pl-container">
          <span className="pl-kicker">Cores</span>
          <h2>Neutro para a página, cor para o toldo.</h2>
          {CORES.map((g) => (
            <div key={g.grupo} className="mc-cores">
              <h3>{g.grupo}</h3>
              <ul>
                {g.itens.map((c) => (
                  <li key={c.hex}>
                    <i style={{ background: c.hex }} />
                    <strong>{c.nome}</strong>
                    <code>{c.hex}</code>
                    <small>{c.uso}</small>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="mc-secao mc-secao-alt">
        <div className="pl-container mc-duas">
          <div className="mc-letra">
            <span className="pl-kicker">Letras</span>
            <h2>Inter para trabalhar, serifa para vender.</h2>
            <p><b>Inter</b> em toda a interface: títulos em 700 com espaçamento apertado, texto em 400, números de preço e estoque em 600.</p>
            <p>Nome de marca dentro das cenas e vitrines de exemplo em <b>serifa</b> (Iowan Old Style, Palatino, Georgia), para a tela ter cara de loja e não de software.</p>
          </div>
          <div className="mc-amostras">
            <p className="mc-amostra-titulo">A loja com a cara do seu negócio.</p>
            <p className="mc-amostra-texto">Pix na hora, cartão e boleto, frete por CEP e o pedido avisado no WhatsApp.</p>
            <p className="mc-amostra-vitrine">Ateliê Lis</p>
          </div>
        </div>
      </section>

      <section className="mc-secao">
        <div className="pl-container">
          <span className="pl-kicker">Aplicações</span>
          <h2>Onde a marca aparece, e onde ela sai da frente.</h2>
          <div className="mc-apps">
            {APLICACOES.map((a) => (
              <article key={a.titulo} className={a.classe}>
                <div className="mc-app-tela" aria-hidden="true"><span /><span /><span /></div>
                <h3>{a.titulo}</h3>
                <small>{a.onde}</small>
                <p>{a.regra}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mc-secao mc-secao-alt">
        <div className="pl-container mc-regras">
          <div>
            <h3>Faça</h3>
            <ul>{FACA.map((t) => <li key={t}><Check size={16} aria-hidden="true" />{t}</li>)}</ul>
          </div>
          <div>
            <h3>Não faça</h3>
            <ul>{NAO_FACA.map((t) => <li key={t}><X size={16} aria-hidden="true" />{t}</li>)}</ul>
          </div>
        </div>
      </section>

      <section className="mc-secao" id="arquivos">
        <div className="pl-container">
          <span className="pl-kicker">Arquivos</span>
          <h2>Para baixar.</h2>
          <ul className="mc-arquivos">
            {ARQUIVOS.map((a) => (
              <li key={a.arquivo}>
                <strong>{a.nome}</strong>
                <span>
                  <a href={`/media/marca/${a.arquivo}`} download><Download size={14} aria-hidden="true" /> SVG</a>
                  {"png" in a && <a href={`/media/marca/${a.png}`} download><Download size={14} aria-hidden="true" /> PNG</a>}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
