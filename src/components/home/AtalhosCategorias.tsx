import Link from "next/link";
import { PRINCIPAIS } from "@/components/Header";
import IconeCategoria from "@/components/IconeCategoria";
import { categoriasParaVitrine } from "@/lib/catalogo";
import type { TemaLoja } from "@/lib/tema";

/**
 * Atalhos redondos de categoria, na primeira tela.
 *
 * É o padrão que o Mercado Livre e a Amazon usam no topo do celular, e existe
 * por um motivo prático: quem abre uma loja de peça pelo telefone ou busca pelo
 * código, ou entra pelo departamento. A tira de texto do cabeçalho serve à
 * segunda intenção, mas nomes industriais longos ("Aço de baixo e médio teor de
 * carbono") não se distinguem de relance. A foto distingue.
 *
 * O que acontece com categoria sem foto é decisão da loja
 * (`tema.categoriaSemImagem`, padrão "ocultar"): ver `categoriasParaVitrine`.
 * A regra não mora aqui de propósito; este componente só desenha o que a
 * política deixou passar.
 */
export default function AtalhosCategorias({
  categorias,
  semImagem,
  grande = false,
}: {
  categorias: Array<{ id: string; slug: string; nome: string; imagemUrl: string | null }>;
  semImagem: TemaLoja["categoriaSemImagem"];
  grande?: boolean;
}) {
  const lista = categoriasParaVitrine(categorias, semImagem);
  // Menos de três atalhos não formam uma fileira: viram dois círculos soltos
  // ocupando espaço que o produto usaria melhor.
  if (lista.length < 3) return null;

  return (
    <nav className="atalhos-cat" aria-label="Categorias em destaque">
      <div className={grande ? "atalhos-cat-tira" : "container-loja atalhos-cat-tira"}>
        {lista.slice(0, PRINCIPAIS).map((c) => (
          <Link key={c.id} href={`/categoria/${c.slug}`}>
            <span className="atalhos-cat-foto">
              {c.imagemUrl ? (
                // `lazy` de propósito, mesmo estando na primeira tela: o React
                // 19 emite <link rel=preload> para todo <img> não-lazy do
                // shell, até dez. Com `eager` as oito fotos de categoria iam
                // para o <head> e disputavam banda com o banner, que é o LCP.
                // O círculo tem 3,5rem fixos no CSS, então não há salto de
                // layout enquanto a foto chega.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imagemUrl} alt="" loading="lazy" decoding="async" width={56} height={56} />
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
