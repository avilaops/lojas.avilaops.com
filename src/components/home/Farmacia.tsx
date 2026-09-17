import Link from "next/link";
import { temaDo } from "@/lib/tenant";
import { ArrowRight, Search, ShieldCheck, Stethoscope } from "lucide-react";
import ProductCard from "@/components/ProductCard";
import BeneficiosBarra from "./BeneficiosBarra";
import AtalhosCategorias from "./AtalhosCategorias";
import { lerResponsavel, responsavelCompleto } from "@/lib/farmacia";
import type { DadosHome } from "./tipos";

/**
 * Farmácia e drogaria.
 *
 * O que este layout faz e nenhum outro faz: **abre pela busca**, não pela
 * vitrine. Em toda outra loja a primeira tela existe para despertar vontade;
 * aqui a pessoa já chegou sabendo — tem uma receita na mão, ou uma dor. Pôr um
 * banner de campanha entre ela e o campo de busca é atrapalhar a única coisa
 * que ela veio fazer.
 *
 * Daí as duas portas de entrada, nesta ordem:
 *
 *   1. o campo de busca, que desde a migração `20260917100000_farmacia` acha
 *      tanto pela marca ("Novalgina") quanto pela molécula ("dipirona") —
 *      porque o que está escrito na receita varia, e o comprador não sabe qual
 *      dos dois a loja cadastrou;
 *   2. os atalhos por necessidade, para quem não tem receita nenhuma e sabe
 *      apenas o que está sentindo. São buscas prontas (`src/lib/farmacia.ts`,
 *      `NECESSIDADES`): não inventam categoria e não exigem que o lojista
 *      cadastre nada de novo. Só aparecem os que o catálogo tem como atender
 *      (`necessidadesDaLoja`) — chip que cai em "nenhum produto encontrado"
 *      ensina o comprador que a loja não trabalha com aquilo.
 *
 * E o farmacêutico responsável aparece na primeira tela, não só no rodapé.
 * Numa drogaria isso não é selo de confiança de e-commerce, é a informação que
 * a RDC 44/2009 obriga a loja a exibir — e é também o que diferencia uma
 * farmácia de verdade de um site que vende remédio.
 */
export default function Farmacia({ t, identidade, categorias, vitrine, temDestaques, vende, necessidades = [] }: DadosHome) {
  const responsavel = lerResponsavel(t);
  const temResponsavel = responsavelCompleto(responsavel);

  return (
    <main className="home-mercado home-farmacia">
      <section className="farmacia-abertura">
        <div className="container-loja">
          <p className="home-selo text-primary">{identidade.palavrasChave[0] || "Sua farmácia"}</p>
          <h1>{t.slogan ?? t.nome}</h1>
          <p>{t.sobre || identidade.diferencial || "Busque pelo nome do remédio ou pela substância da receita."}</p>

          {/* O formulário é GET para /produtos, o mesmo da busca do cabeçalho:
              a URL do resultado é indexável e compartilhável, e o comprador que
              procura a mesma substância toda semana pode salvá-la. */}
          <form action="/produtos" method="get" className="farmacia-busca" role="search">
            <label className="sr-only" htmlFor="farmacia-busca">Buscar medicamento ou substância</label>
            <Search aria-hidden="true" />
            <input
              id="farmacia-busca"
              name="q"
              type="search"
              placeholder="Nome do remédio ou princípio ativo"
              autoComplete="off"
            />
            <button type="submit" className="btn-primario">Buscar</button>
          </form>

          {/* Só os atalhos que a loja tem como atender: chip que cai em
              "nenhum produto encontrado" é beco sem saída, e quem clica conclui
              que a loja não trabalha com aquilo. O corte é feito no catálogo
              (`necessidadesDaLoja`), não aqui. */}
          {necessidades.length > 0 && (
            <ul className="farmacia-necessidades">
              {necessidades.map((n) => (
                <li key={n.termo}>
                  <Link href={`/produtos?q=${encodeURIComponent(n.termo)}`}>{n.rotulo}</Link>
                </li>
              ))}
            </ul>
          )}

          {temResponsavel && (
            <p className="farmacia-responsavel-topo">
              <Stethoscope aria-hidden="true" />
              Farmacêutico(a) responsável: <strong>{responsavel.nome}</strong> · {responsavel.crf}
            </p>
          )}
        </div>
      </section>

      <AtalhosCategorias categorias={categorias} semImagem={temaDo(t).categoriaSemImagem} />

      <div className="container-loja"><BeneficiosBarra t={t} /></div>

      {categorias.length > 0 && (
        <section className="container-loja mercado-departamentos">
          <header>
            <div>
              <p className="home-selo text-primary">Departamentos</p>
              <h2>O que você procura</h2>
            </div>
            <Link href="/produtos">Ver tudo <ArrowRight /></Link>
          </header>
          <div className="mercado-grade-categorias">
            {categorias.slice(0, 10).map((categoria) => (
              <Link key={categoria.id} href={`/categoria/${categoria.slug}`}>
                {categoria.imagemUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={categoria.imagemUrl} alt="" loading="lazy" />
                )}
                <span>{categoria.nome}</span><ArrowRight />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="container-loja mercado-produtos">
        <header>
          <div>
            <p className="home-selo text-primary">Na prateleira</p>
            <h2>{temDestaques ? "Destaques" : "Produtos disponíveis"}</h2>
          </div>
          <Link href="/produtos">Ver tudo <ArrowRight /></Link>
        </header>
        {vitrine.length === 0 ? (
          <p className="home-vazio">Os primeiros produtos estão sendo organizados para esta vitrine.</p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {vitrine.slice(0, 10).map((produto) => <ProductCard key={produto.id} produto={produto} vende={vende} whatsapp={t.whatsapp} />)}
          </div>
        )}
      </section>

      {temResponsavel && (
        <section className="container-loja farmacia-orientacao">
          <ShieldCheck aria-hidden="true" />
          <div>
            <h2>Dúvida sobre o medicamento? Fale com o farmacêutico.</h2>
            <p>
              Orientação farmacêutica sobre dose, horário e interação faz parte da dispensação.
              Responsável técnico: {responsavel.nome} · {responsavel.crf}.
            </p>
          </div>
          <Link href="/contato" className="btn-secundario">Falar com a loja</Link>
        </section>
      )}
    </main>
  );
}
