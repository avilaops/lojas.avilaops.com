/** Título da seção. No celular a barra do topo já diz onde se está, então aqui
 *  o que importa é a linha de apoio: o que a tela resolve. */
import Link from "next/link";

export default function CabecalhoSecao({ titulo, descricao, acao }: { titulo: string; descricao?: string; acao?: { rotulo: string; href: string } }) {
  return (
    <header className="padm-cabecalho">
      <div><h1>{titulo}</h1>{descricao && <p>{descricao}</p>}</div>
      {acao && <Link className="btn-secundario" href={acao.href}>{acao.rotulo}</Link>}
    </header>
  );
}
