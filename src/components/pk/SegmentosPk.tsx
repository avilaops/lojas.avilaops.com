import Link from "@/components/LinkLoja";
import { ArrowUpRight, Factory, Sprout, HardHat, Truck, Waypoints } from "lucide-react";
import { gruposSegmentosPk } from "@/lib/jornada-pk";

const ICONES = [Factory, Sprout, HardHat, Truck, Waypoints];

export default function SegmentosPk({ tenantSlug }: { tenantSlug: string }) {
  const grupos = gruposSegmentosPk(tenantSlug);
  if (!grupos.length) return null;
  return <section aria-label="Aplicações organizadas por finalidade">
    <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {grupos.map((grupo, indice) => {
        const Icone = ICONES[indice];
        return <div key={grupo.id} className="min-w-0 rounded-xl border border-border bg-card p-5">
          <Icone className="mb-4 size-6 text-primary" aria-hidden="true" />
          <h3 className="text-lg font-bold leading-snug">{grupo.titulo}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{grupo.descricao}</p>
          <ul className="mt-4 space-y-2">{grupo.itens.map(item => <li key={item.slug}><Link href={`/aplicacoes/${item.slug}`} className="inline-flex min-h-11 items-start gap-1 py-2 text-sm font-medium underline decoration-primary/30 underline-offset-4 hover:decoration-primary">{item.titulo}<ArrowUpRight className="mt-1 size-3 shrink-0" aria-hidden="true" /></Link></li>)}</ul>
        </div>;
      })}
    </div>
    <p className="mt-4 max-w-3xl text-sm leading-relaxed text-muted-foreground">O segmento ajuda a entender o equipamento. A seleção da vedação depende do perfil, das medidas, do fluido e das condições de trabalho de cada referência.</p>
  </section>;
}
