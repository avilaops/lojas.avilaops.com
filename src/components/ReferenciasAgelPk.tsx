import Conteudo from "@/content/pkvedacoes/referencias-agel.mdx";
import { fonteAgelPk, referenciaAgelPk } from "@/lib/referencias-agel-pk";

/** HTML visível renderizado no servidor, no endereço canônico do produto PK. */
export default function ReferenciasAgelPk({ tenantSlug, produto }: { tenantSlug: string; produto: { slug: string; atributos: unknown } }) {
  const referencia = referenciaAgelPk(tenantSlug, produto);
  if (!referencia) return null;
  const mm = (valor: number) => `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 3 })} mm`;
  return (
    <section className="mt-6 rounded-lg border border-border p-4" aria-label="Referências relacionadas Agel e PK">
      <Conteudo components={{ DetalhesAgel: () => (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt>Código Agel</dt><dd className="font-semibold">AGEL {referencia.codigoAgel}</dd>
            <dt>Código PK</dt><dd>{referencia.codigoPk}</dd>
            <dt>Referência comum</dt><dd>{referencia.referencia}</dd>
            <dt>Diâmetro externo</dt><dd>{mm(referencia.diametroExternoMm)}</dd>
            <dt>Seção</dt><dd>{mm(referencia.secaoMm)}</dd>
            <dt>Altura</dt><dd>{mm(referencia.alturaMm)}</dd>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">Fonte: Catálogo de Componentes e Conjuntos Diversos Agel, edição {fonteAgelPk.edicao}, página {referencia.pagina}.</p>
        </>
      ) }} />
    </section>
  );
}
