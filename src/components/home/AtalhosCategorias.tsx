import Link from "next/link";
import { PRINCIPAIS } from "@/components/Header";
import IconeCategoria from "@/components/IconeCategoria";

/**
 * Atalhos redondos de categoria, na primeira tela.
 *
 * É o padrão que o Mercado Livre e a Amazon usam no topo do celular, e existe
 * por um motivo prático: quem abre uma loja de peça pelo telefone ou busca pelo
 * código, ou entra pelo departamento. A tira de texto do cabeçalho serve à
 * segunda intenção, mas nomes industriais longos ("Aço de baixo e médio teor de
 * carbono") não se distinguem de relance. A foto distingue.
 *
 * Quando a categoria ainda não tem foto confiável, entra o pictograma técnico
 * da família. É mais honesto que usar uma foto aproximada e mais útil que uma
 * inicial genérica.
 */
export default function AtalhosCategorias({
  categorias,
}: {
  categorias: Array<{ id: string; slug: string; nome: string; imagemUrl: string | null }>;
}) {
  if (categorias.length < 3) return null;

  return (
    <nav className="atalhos-cat" aria-label="Categorias em destaque">
      <div className="container-loja atalhos-cat-tira">
        {categorias.slice(0, PRINCIPAIS).map((c) => (
          <Link key={c.id} href={`/categoria/${c.slug}`}>
            <span className="atalhos-cat-foto">
              {c.imagemUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imagemUrl} alt="" loading="eager" />
              ) : (
                <IconeCategoria slug={c.slug} />
              )}
            </span>
            {/* Duas linhas no máximo: o nome inteiro numa só empurraria a
                fileira para o dobro da altura por causa de uma categoria. */}
            <span className="atalhos-cat-nome">{c.nome}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
