import Link from "next/link";
import { temaDo } from "@/lib/tenant";
import ProductCard from "@/components/ProductCard";
import { paragrafosDaDescricao } from "@/lib/descricao-produto";
import BuscaPorMedida from "./BuscaPorMedida";
import type { DadosHome } from "./tipos";

/**
 * Home de fabricante que vende peça técnica por medida.
 *
 * Quem chega aqui tem uma peça gasta na mão e um paquímetro: o topo da página
 * é a busca pelas três medidas, não um banner. Depois vêm as linhas de produto
 * com o que cada uma faz e aguenta (a descrição da categoria), os destaques,
 * os diferenciais da loja e o contato comercial. Tudo é dado da loja: foto do
 * topo e diferenciais em `tema.industrial`, o resto no catálogo e no cadastro.
 */
export default function Industrial({ t, categorias, vitrine, temDestaques, vende, moto }: DadosHome) {
  const tema = temaDo(t);
  const foto = tema.industrial?.heroImagem;
  const diferenciais = tema.industrial?.diferenciais ?? [];
  const titulo = tema.heroTitulo || t.slogan || t.nome;
  const texto = tema.heroTexto || paragrafosDaDescricao(t.sobre ?? "")[0] || "";
  const sobre = paragrafosDaDescricao(t.sobre ?? "").slice(0, 3);
  const whatsapp = t.whatsapp ? `https://wa.me/${t.whatsapp.replace(/\D/g, "")}` : null;

  return (
    <main className="home-industrial">
      <section className="industrial-topo" aria-labelledby="industrial-titulo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {foto && <img className="industrial-topo-foto" src={foto} alt="" width={1536} height={1024} fetchPriority="high" />}
        <div className="container-loja industrial-topo-conteudo">
          <p className="industrial-topo-marca">{t.nome}</p>
          <h1 id="industrial-titulo">{titulo}</h1>
          {texto && <p className="industrial-topo-texto">{texto}</p>}
          <BuscaPorMedida />
          <p className="industrial-topo-atalho">
            Tem o código ou a referência da peça? <Link href="/produtos">Busque no catálogo completo</Link>.
          </p>
        </div>
      </section>

      {categorias.length > 0 && (
        <section className="container-loja industrial-linhas" aria-labelledby="industrial-linhas-titulo">
          <h2 id="industrial-linhas-titulo">Linhas de produto</h2>
          <ul>
            {categorias.map((c) => (
              <li key={c.id}>
                <Link href={`/categoria/${c.slug}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {c.imagemUrl && <img src={c.imagemUrl} alt="" loading="lazy" decoding="async" width={320} height={320} />}
                  <span className="industrial-linha-texto">
                    <strong>{c.nome}</strong>
                    {c.descricao && <span>{paragrafosDaDescricao(c.descricao)[0]}</span>}
                    <em>Ver medidas disponíveis</em>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {vitrine.length > 0 && (
        <section className="container-loja industrial-produtos" aria-labelledby="industrial-produtos-titulo">
          <header>
            <h2 id="industrial-produtos-titulo">{temDestaques ? "Produtos em destaque" : "Produtos do catálogo"}</h2>
            <Link href="/produtos">Ver catálogo completo</Link>
          </header>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {vitrine.slice(0, 8).map((produto) => <ProductCard loja={t} key={produto.id} produto={produto} vende={vende} whatsapp={t.whatsapp} moto={moto} ocultarSeloDestaque />)}
          </div>
        </section>
      )}

      {diferenciais.length > 0 && (
        <section className="industrial-diferenciais" aria-labelledby="industrial-diferenciais-titulo">
          <div className="container-loja">
            <h2 id="industrial-diferenciais-titulo">Por que comprar com a {t.nome}</h2>
            <dl>
              {diferenciais.map((d) => (
                <div key={d.titulo}><dt>{d.titulo}</dt><dd>{d.texto}</dd></div>
              ))}
            </dl>
          </div>
        </section>
      )}

      <section className="container-loja industrial-empresa" aria-labelledby="industrial-empresa-titulo">
        <div>
          <h2 id="industrial-empresa-titulo">A empresa</h2>
          {sobre.map((p) => <p key={p.slice(0, 40)}>{p}</p>)}
          <Link href="/sobre">Conheça a {t.nome}</Link>
        </div>
        <aside aria-label="Atendimento comercial">
          <h3>Fale com o comercial</h3>
          <p>Envie a medida, o código ou a referência da peça e receba a cotação.</p>
          {whatsapp && <a className="industrial-contato-botao" href={whatsapp} target="_blank" rel="noopener noreferrer">Pedir cotação pelo WhatsApp</a>}
          <ul>
            {t.telefone && <li><span>Telefone</span><a href={`tel:${t.telefone.replace(/[^\d+]/g, "")}`}>{t.telefone}</a></li>}
            {t.emailContato && <li><span>E-mail</span><a href={`mailto:${t.emailContato}`}>{t.emailContato}</a></li>}
          </ul>
        </aside>
      </section>
    </main>
  );
}
