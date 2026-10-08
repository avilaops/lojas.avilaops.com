import Link from "@/components/LinkLoja";
import { ArrowRight, Search } from "lucide-react";
import TabelaTecnica from "@/components/TabelaTecnica";
import type { DadosHome } from "./tipos";

/**
 * Tabela de peças no lugar da grade de fotos: código, código original,
 * equivalentes, medidas e aplicação, que é o que quem compra peça confere
 * primeiro. As colunas saem do catálogo; a que a loja não usa não aparece.
 */
export default function CatalogoTecnico({ t, vitrine, temDestaques, vende }: DadosHome) {
  const titulo = temDestaques ? "Destaques do catálogo" : "Produtos disponíveis";

  return (
    <main className="home-catalogo-tecnico">
      <section className="ct-abertura">
        <div className="container-loja">
          <h1>{t.slogan ?? t.nome}</h1>
          {t.slogan && <p>{t.nome}</p>}
          {/* Formulário GET puro: funciona sem JavaScript e a URL do resultado
              é compartilhável. */}
          <form action="/produtos" method="get" className="ct-busca" role="search">
            <label className="sr-only" htmlFor="ct-busca">Buscar por nome, código ou medida</label>
            <Search aria-hidden="true" />
            <input id="ct-busca" name="q" type="search" placeholder="Nome, código ou medida" autoComplete="off" />
            <button type="submit" className="btn-primario">Buscar</button>
          </form>
        </div>
      </section>

      <section className="container-loja ct-catalogo">
        <header><h2>{titulo}</h2><Link href="/produtos">Ver tudo <ArrowRight /></Link></header>
        {vitrine.length === 0 ? (
          <p className="home-vazio">O catálogo está em preparação. Os primeiros produtos aparecem aqui em breve.</p>
        ) : (
          <TabelaTecnica produtos={vitrine} vende={vende} titulo={titulo} nomeDaLoja={t.nome} />
        )}
      </section>
    </main>
  );
}
