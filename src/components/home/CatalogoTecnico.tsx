import Link from "next/link";
import { ArrowRight, Search } from "lucide-react";
import { formatarBRL } from "@/lib/catalogo";
import { sobConsulta } from "@/lib/produto-regras";
import { ROTULOS_COLUNA, colunasVisiveis, linhaTecnica, type Coluna, type LinhaTecnica } from "@/lib/catalogo-tecnico";
import type { DadosHome } from "./tipos";

function celula(linha: LinhaTecnica, coluna: Coluna) {
  if (coluna === "equivalentes") return linha.equivalentes.join(", ") || "—";
  if (coluna === "aplicacao") {
    const { texto, restantes } = linha.aplicacao;
    return restantes > 0 ? <>{texto} <span className="ct-mais">+{restantes}</span></> : texto;
  }
  return linha[coluna] ?? "—";
}

/**
 * Tabela de peças no lugar da grade de fotos: código, código original,
 * equivalentes, medidas e aplicação, que é o que quem compra peça confere
 * primeiro. As colunas saem do catálogo; a que a loja não usa não aparece.
 */
export default function CatalogoTecnico({ t, vitrine, temDestaques }: DadosHome) {
  const linhas = vitrine.map((produto) => ({ produto, linha: linhaTecnica(produto) }));
  const colunas = colunasVisiveis(linhas.map((l) => l.linha));
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
        {linhas.length === 0 ? (
          <p className="home-vazio">O catálogo está em preparação. Os primeiros produtos aparecem aqui em breve.</p>
        ) : (
          <div className="ct-rolagem" role="region" aria-label={titulo} tabIndex={0}>
            <table className="ct-tabela">
              <caption className="sr-only">{titulo} de {t.nome}</caption>
              <thead>
                <tr>
                  <th scope="col">Produto</th>
                  {colunas.map((coluna) => <th scope="col" key={coluna}>{ROTULOS_COLUNA[coluna]}</th>)}
                  <th scope="col" className="ct-preco">Preço</th>
                </tr>
              </thead>
              <tbody>
                {linhas.map(({ produto, linha }) => (
                  <tr key={produto.id}>
                    <th scope="row"><Link href={`/produtos/${linha.slug}`}>{linha.nome}</Link></th>
                    {colunas.map((coluna) => <td key={coluna} className={`ct-${coluna}`}>{celula(linha, coluna)}</td>)}
                    <td className="ct-preco">{sobConsulta(produto) ? "Sob consulta" : formatarBRL(produto.precoCentavos)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
