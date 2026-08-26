import Link from "next/link";
import type { ProvaSocial as Dados } from "@/lib/catalogo";

/**
 * Prova social da home. Fica abaixo do layout escolhido, igual nos quatro —
 * é conteúdo do comprador, não composição do lojista, então não vira mais uma
 * escolha para ele errar.
 */
export default function ProvaSocial({ dados, nomeDaLoja }: { dados: Dados; nomeDaLoja: string }) {
  // Loja recém-aberta não mostra depoimento: duas avaliações passam a impressão
  // contrária à que se quer.
  if (dados.avaliacoes.length < 3) return null;

  return (
    <section className="prova-social">
      <div className="container-loja">
        <header>
          <h2>Quem comprou na {nomeDaLoja}</h2>
          {dados.media !== null && (
            <p>
              <Estrelas nota={Math.round(dados.media)} />
              <strong>{dados.media.toFixed(1).replace(".", ",")}</strong> de 5 em {dados.total} avaliaç{dados.total === 1 ? "ão" : "ões"}
            </p>
          )}
        </header>

        <ul>
          {dados.avaliacoes.map((a) => (
            <li key={a.id}>
              <Estrelas nota={a.nota} />
              <blockquote>{a.texto}</blockquote>
              <footer>
                {a.nome} · <Link href={`/produtos/${a.produtoSlug}`}>{a.produtoNome}</Link>
              </footer>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Estrelas({ nota }: { nota: number }) {
  return (
    <span className="prova-estrelas" aria-label={`${nota} de 5`}>
      {"★".repeat(nota)}
      <span aria-hidden="true">{"☆".repeat(5 - nota)}</span>
    </span>
  );
}
