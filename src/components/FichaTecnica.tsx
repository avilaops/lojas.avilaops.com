import { fichaDoProduto } from "@/lib/ficha";
import { fichaPersonalizada, type CampoPersonalizado, type LinhaFicha } from "@/lib/campos-personalizados";

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
 *
 * Os campos que a loja definiu vêm primeiro, na ordem que ela escolheu: são a
 * resposta que ela decidiu dar, e vencem o que sobrou da importação do ERP.
 * Vídeo sai da lista de duas colunas e vira bloco próprio — tabela com
 * `<iframe>` dentro não se lê em 393px.
 */
export default function FichaTecnica({
  atributos,
  definicoes = [],
  valores = {},
}: {
  atributos: Record<string, unknown>;
  /** Campos que esta loja acrescenta ao produto. Ver src/lib/campos-personalizados.ts. */
  definicoes?: CampoPersonalizado[];
  valores?: Record<string, string>;
}) {
  const daLoja = fichaPersonalizada(definicoes, valores);
  const videos = daLoja.filter((l): l is LinhaFicha & { video: NonNullable<LinhaFicha["video"]> } => Boolean(l.video));
  const linhasDaLoja = daLoja.filter((l) => !l.video);
  const linhas = fichaDoProduto(atributos);
  if (linhas.length === 0 && linhasDaLoja.length === 0 && videos.length === 0) return null;

  return (
    <>
      {(linhas.length > 0 || linhasDaLoja.length > 0) && (
        <section className="ficha-tecnica">
          <h2>Características</h2>
          <dl>
            {linhasDaLoja.map((l) => (
              <div key={`loja-${l.chave}`}>
                <dt>{l.rotulo}</dt>
                <dd>{l.tipo === "url" || l.tipo === "imagem" ? <a href={l.valor} target="_blank" rel="noopener nofollow">Abrir</a> : l.valor}</dd>
              </div>
            ))}
            {linhas.map((l) => (
              <div key={l.chave}>
                <dt>{l.rotulo}</dt>
                <dd>{l.valor}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {videos.map((l) => (
        <section key={`video-${l.chave}`} className="ficha-video">
          <h2>{l.rotulo}</h2>
          <div className="ficha-video-moldura">
            <iframe
              src={l.video.embed}
              title={l.rotulo}
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </section>
      ))}
    </>
  );
}
