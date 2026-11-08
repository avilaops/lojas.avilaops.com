import { medidasPk, TENANT_PK } from "@/lib/pk-produtos";

export function DesenhoTecnico({ tenantSlug, atributos }: { tenantSlug: string; atributos: unknown }) {
  if (tenantSlug !== TENANT_PK) return null;
  const m = medidasPk(atributos);
  if (Object.values(m).every(v => v === null)) return null;
  const mm = (v: number | null) => v === null ? "não informado" : `${v.toLocaleString("pt-BR")} mm`;
  return <figure className="rounded-xl border p-5"><figcaption className="font-semibold">Esquema dimensional</figcaption><svg viewBox="0 0 600 260" role="img" aria-label={`Diâmetro interno: ${mm(m.di)}; diâmetro externo: ${mm(m.de)}; altura: ${mm(m.altura)}; seção: ${mm(m.secao)}.`} className="mt-3 w-full text-gray-700"><title>Medidas cadastradas do produto</title><desc>Esquema sem escala. Círculos e retângulo indicam somente direções de medição, sem representar o perfil construtivo.</desc><g fill="none" stroke="currentColor" strokeWidth="2"><circle cx="145" cy="115" r="80" strokeDasharray="5 4"/><circle cx="145" cy="115" r="43" strokeDasharray="5 4"/><path d="M65 210H225 M65 202V218 M225 202V218 M102 115H188 M102 107V123 M188 107V123"/><rect x="360" y="70" width="110" height="100" strokeDasharray="5 4"/><path d="M495 70V170 M487 70H503 M487 170H503 M360 190H470 M360 182V198 M470 182V198"/></g><g fill="currentColor" fontSize="13" textAnchor="middle"><text x="145" y="100">DI: {mm(m.di)}</text><text x="145" y="238">DE: {mm(m.de)}</text><text x="415" y="226">Seção: {mm(m.secao)}</text><text x="415" y="48">Altura: {mm(m.altura)}</text></g></svg><p className="text-sm text-gray-600">Sem escala. Representação das cotas disponíveis; não reproduz lábios, cortes ou geometria exata do perfil.</p></figure>;
}
