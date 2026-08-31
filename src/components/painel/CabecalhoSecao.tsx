/** Título da seção. No celular a barra do topo já diz onde se está, então aqui
 *  o que importa é a linha de apoio: o que a tela resolve. */
export default function CabecalhoSecao({ titulo, descricao }: { titulo: string; descricao?: string }) {
  return (
    <header className="padm-cabecalho">
      <h1>{titulo}</h1>
      {descricao && <p>{descricao}</p>}
    </header>
  );
}
