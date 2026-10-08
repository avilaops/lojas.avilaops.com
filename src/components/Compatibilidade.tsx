import Link from "@/components/LinkLoja";
import { descreverAnos, encaixe, lerCompatibilidade, linhaServe, nomeDaMoto, queryDaMoto, type Moto } from "@/lib/motos";

/**
 * Bloco de compatibilidade da página do produto: "serve na sua moto?" em
 * destaque, depois a tabela completa (marca, modelo, anos) e os códigos
 * original e equivalentes. Cada modelo é link para "peças para essa moto".
 */
export default function Compatibilidade({ compatibilidade, codigoOriginal, codigosEquivalentes, moto }: { compatibilidade: unknown; codigoOriginal: string | null; codigosEquivalentes: string[]; moto: Moto | null }) {
  const linhas = lerCompatibilidade(compatibilidade);
  if (!linhas.length && !codigoOriginal && !codigosEquivalentes.length) return null;
  const situacao = encaixe(compatibilidade, moto);

  return (
    <section className="compatibilidade mt-6">
      {moto && linhas.length > 0 && (
        <p className={`compat-selo compat-${situacao}`} role="status">
          {situacao === "serve" ? <>✔ Serve na sua <strong>{nomeDaMoto(moto)}</strong></> : <>✕ Não consta para <strong>{nomeDaMoto(moto)}</strong>, confira a lista abaixo ou pergunte no WhatsApp</>}
        </p>
      )}
      {linhas.length > 0 && (
        <>
          <h2 className="mb-2 text-base font-bold">Compatível com</h2>
          <table className="compat-tabela">
            <tbody>
              {linhas.map((c, i) => (
                <tr key={i} className={moto && linhaServe(c, moto) ? "compat-linha-ativa" : undefined}>
                  <td>{c.marca}</td>
                  <td><Link href={`/produtos?${queryDaMoto({ marca: c.marca, modelo: c.modelo })}`}>{c.modelo}</Link></td>
                  <td>{descreverAnos(c)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {(codigoOriginal || codigosEquivalentes.length > 0) && (
        <dl className="compat-codigos">
          {codigoOriginal && <div><dt>Código original</dt><dd>{codigoOriginal}</dd></div>}
          {codigosEquivalentes.length > 0 && <div><dt>Substitui / equivale a</dt><dd>{codigosEquivalentes.join(", ")}</dd></div>}
        </dl>
      )}
    </section>
  );
}
