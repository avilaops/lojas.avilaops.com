import { fichaDoProduto } from "@/lib/ficha";

/**
 * Características do produto, no formato que todo marketplace usa.
 *
 * O campo `atributos` existe no banco desde sempre, livre, e nenhuma tela
 * mostrava. Sem ele a página do produto vira dois parágrafos de texto corrido,
 * e quem compra peça técnica não lê parágrafo: procura a linha da bitola, da
 * amperagem, da medida do eixo. É por isso que Mercado Livre e Amazon põem
 * característica em lista de duas colunas, e não em prosa.
 *
 * O que entra, com que rótulo e em que ordem é decisão de `lib/ficha.ts`, a
 * mesma que alimenta o JSON-LD: o crawler e a pessoa leem a mesma ficha.
 */
export default function FichaTecnica({ atributos }: { atributos: Record<string, unknown> }) {
  const linhas = fichaDoProduto(atributos);
  if (linhas.length === 0) return null;

  return (
    <section className="ficha-tecnica">
      <h2>Características</h2>
      <dl>
        {linhas.map((l) => (
          <div key={l.chave}>
            <dt>{l.rotulo}</dt>
            <dd>{l.valor}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
