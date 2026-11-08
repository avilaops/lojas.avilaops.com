import Conteudo from "@/content/pkvedacoes/referencias-agel.mdx";
import { fonteAgelPk, referenciaAgelPk } from "@/lib/referencias-agel-pk";

/** HTML visível renderizado no servidor, no endereço canônico do produto PK. */
export default function ReferenciasAgelPk({ tenantSlug, produto }: { tenantSlug: string; produto: { slug: string; atributos: unknown } }) {
  const referencia = referenciaAgelPk(tenantSlug, produto);
  if (!referencia) return null;
  return (
    <section className="mt-6 rounded-lg border border-border p-4" aria-label="Códigos relacionados">
      <Conteudo components={{ DetalhesAgel: () => (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt>Código Agel</dt><dd className="font-semibold">AGEL {referencia.codigoAgel}</dd>
            <dt>Código PK</dt><dd>{referencia.codigoPk}</dd>
            <dt>Referência comum</dt><dd>{referencia.referencia}</dd>
          </dl>
          <details className="mt-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer">Fonte e critérios da referência</summary>
            <p className="mt-2">Catálogo de Componentes e Conjuntos Diversos Agel, edição {fonteAgelPk.edicao}, página {referencia.pagina}. O catálogo informa nylon 66 com fibra de vidro; a PK informa nylon com fibra de vidro. Confirme perfil, material e aplicação antes da substituição.</p>
          </details>
        </>
      ) }} />
    </section>
  );
}
