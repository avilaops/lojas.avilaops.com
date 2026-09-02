import Link from "next/link";

/**
 * Atalhos redondos de categoria, na primeira tela.
 *
 * É o padrão que o Mercado Livre e a Amazon usam no topo do celular, e existe
 * por um motivo prático: quem abre uma loja de peça pelo telefone ou busca pelo
 * código, ou entra pelo departamento. A tira de texto do cabeçalho serve à
 * segunda intenção, mas nomes industriais longos ("Aço de baixo e médio teor de
 * carbono") não se distinguem de relance. A foto distingue.
 *
 * Só aparece com foto de verdade: círculo com a inicial da categoria seria
 * enfeite ocupando a área mais cara da página.
 */
export default function AtalhosCategorias({
  categorias,
}: {
  categorias: Array<{ id: string; slug: string; nome: string; imagemUrl: string | null }>;
}) {
  const comFoto = categorias.filter((c) => c.imagemUrl);
  // Menos de três atalhos não formam uma fileira: viram dois círculos soltos
  // ocupando espaço que o produto usaria melhor.
  if (comFoto.length < 3) return null;

  return (
    <nav className="atalhos-cat" aria-label="Categorias em destaque">
      <div className="container-loja atalhos-cat-tira">
        {comFoto.slice(0, 8).map((c) => (
          <Link key={c.id} href={`/categoria/${c.slug}`}>
            <span className="atalhos-cat-foto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={c.imagemUrl!} alt="" loading="eager" />
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
