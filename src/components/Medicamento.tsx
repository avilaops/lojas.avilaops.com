import Link from "@/components/LinkLoja";
import { formatarBRL } from "@/lib/catalogo";
import {
  avisoDaTarja,
  economia,
  ehMedicamento,
  exigeReceita,
  formatarRegistroAnvisa,
  lerMedicamento,
  rotuloTarja,
  rotuloTipo,
  vendaRemotaProibida,
  type ProdutoFarmaceutico,
} from "@/lib/farmacia";

/** Um equivalente já resolvido pela página: mesma substância, outra caixa. */
export interface Equivalente extends ProdutoFarmaceutico {
  id: string;
  slug: string;
  nome: string;
  marca: string | null;
  precoCentavos: number;
}

/**
 * Bloco farmacêutico da página do produto: tarja, substância, apresentação,
 * registro na Anvisa e — a parte que o comprador realmente veio ver — as outras
 * caixas com o mesmo princípio ativo, com o quanto ele economiza em cada uma.
 *
 * A ordem é deliberada. Primeiro o aviso da tarja, porque é ele que diz se dá
 * para comprar aqui; depois a ficha, que é o que confere se é o remédio certo;
 * por último os equivalentes, que é a decisão de preço. Quem chega com receita
 * quer, nesta ordem: posso comprar, é este mesmo, tem mais barato.
 *
 * A intercambialidade entre genérico e referência é da Lei 9.787/99 e vale para
 * o **genérico**. Por isso o similar aparece na lista rotulado pelo que é, e o
 * texto nunca manda trocar: quem troca é o farmacêutico, e a tela diz isso.
 */
export default function Medicamento({
  produto,
  precoCentavos = 0,
  equivalentes = [],
}: {
  produto: ProdutoFarmaceutico;
  /** Preço do item aberto, para dizer quanto cada equivalente economiza. */
  precoCentavos?: number;
  equivalentes?: Equivalente[];
}) {
  const m = lerMedicamento(produto);
  if (!ehMedicamento(m)) return null;

  const aviso = avisoDaTarja(m.tarja);
  const proibido = vendaRemotaProibida(m.tarja);
  const registro = formatarRegistroAnvisa(m.registroAnvisa);
  const tipo = rotuloTipo(m.tipo);

  return (
    <section className="medicamento mt-6">
      {aviso && (
        <p className={`medicamento-tarja medicamento-tarja-${m.tarja}`} role={proibido ? "alert" : "note"}>
          <strong>{rotuloTarja(m.tarja)}.</strong> {aviso}
        </p>
      )}

      <h2 className="mb-2 text-base font-bold">Informações do medicamento</h2>
      <dl className="medicamento-ficha">
        {m.principioAtivo && (
          <div>
            <dt>Princípio ativo</dt>
            <dd>
              {/* Link para "tudo desta substância": é como o comprador acha o
                  genérico quando a loja tem, e o próximo item quando não tem. */}
              <Link href={`/produtos?q=${encodeURIComponent(m.principioAtivo)}`}>{m.principioAtivo}</Link>
            </dd>
          </div>
        )}
        {m.apresentacao && <div><dt>Apresentação</dt><dd>{m.apresentacao}</dd></div>}
        {tipo && <div><dt>Tipo</dt><dd>{tipo}</dd></div>}
        {registro && <div><dt>Registro Anvisa</dt><dd>{registro}</dd></div>}
        {exigeReceita(m.tarja) && (
          <div><dt>Receita</dt><dd>Obrigatória{m.tarja !== "vermelha" ? ", com retenção" : ""}</dd></div>
        )}
      </dl>

      {equivalentes.length > 0 && (
        <div className="medicamento-equivalentes">
          <h3>Mesma substância, outras opções</h3>
          <p className="medicamento-equivalentes-nota">
            Mesmo princípio ativo e mesma apresentação. A troca por genérico é permitida por lei
            e deve ser orientada pelo farmacêutico.
          </p>
          <ul>
            {equivalentes.map((e) => {
              const em = lerMedicamento(e);
              // Só aparece quando é mais barato de verdade: "economize 0%" ao
              // lado de um preço igual é ruído, e "economize" num item mais
              // caro seria mentira.
              const desconto = economia(precoCentavos, e.precoCentavos);
              return (
                <li key={e.id}>
                  <Link href={`/produtos/${e.slug}`}>
                    <span className="medicamento-eq-nome">
                      {e.nome}
                      {em.tipo && <em>{rotuloTipo(em.tipo)}</em>}
                    </span>
                    {em.apresentacao && <span className="medicamento-eq-apresentacao">{em.apresentacao}</span>}
                    <span className="medicamento-eq-preco">
                      {e.precoCentavos > 0 ? formatarBRL(e.precoCentavos) : "Sob consulta"}
                      {desconto != null && <strong>−{desconto}%</strong>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
