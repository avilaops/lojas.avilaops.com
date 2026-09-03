import Image from "next/image";

/**
 * A capa da categoria. Nunca vazia.
 *
 * O campo `imagemUrl` existia no banco desde sempre e nenhuma tela usava, então
 * toda categoria abria como um título solto numa página branca, com "1 item"
 * embaixo. Categoria sem imagem parece seção em construção, e o comprador que
 * chega ali pela busca acha que a loja está pela metade.
 *
 * A regra é: **sempre tem foto**. Nesta ordem:
 *
 *   1. a imagem que o lojista subiu para a categoria;
 *   2. a foto do primeiro produto dela, que sempre existe quando há produto;
 *   3. e, só se não houver nem isso, uma capa desenhada com a cor da loja.
 *
 * A terceira não é enfeite de emergência: ela usa a inicial e a cor da marca,
 * então mesmo a categoria recém-criada parece parte da loja, e não um buraco.
 */
export default function CapaCategoria({
  nome,
  imagemUrl,
  fotoDoPrimeiroProduto,
  descricao,
}: {
  nome: string;
  imagemUrl: string | null;
  fotoDoPrimeiroProduto: string | null;
  descricao?: string | null;
}) {
  const foto = imagemUrl ?? fotoDoPrimeiroProduto;

  return (
    <header className="capa-categoria">
      <div className="capa-categoria-imagem">
        {foto ? (
          <Image src={foto} alt="" fill sizes="(min-width: 1024px) 420px, 100vw" className="object-cover" priority />
        ) : (
          <span className="capa-categoria-inicial" aria-hidden="true">{nome.trim().charAt(0).toUpperCase()}</span>
        )}
      </div>

      <div className="capa-categoria-texto">
        <h1>{nome}</h1>
        {descricao && <p>{descricao}</p>}
      </div>
    </header>
  );
}
