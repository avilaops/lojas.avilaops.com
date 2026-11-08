import { beneficiosPk } from "@/lib/pk-produtos";

export function BeneficiosProduto({ tenantSlug, nome, atributos }: { tenantSlug: string; nome: string; atributos: unknown }) {
  const beneficios = beneficiosPk(tenantSlug, nome, atributos);
  if (!beneficios.length) return null;
  return <section className="rounded-xl border p-5"><h2 className="mb-3 text-lg font-semibold">Função e seleção</h2><ul className="list-disc space-y-2 pl-5">{beneficios.map(b => <li key={b}>{b}</li>)}</ul><p className="mt-3 text-sm text-gray-600">Confirme aplicação, material e condições de operação com a equipe técnica antes da substituição.</p></section>;
}
