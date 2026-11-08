import Link from "@/components/LinkLoja";
import JornadaPk from "./JornadaPk";
import SegmentosPk from "./SegmentosPk";
export default function DescobertaPk() {
  return <section className="container-loja py-12" aria-labelledby="descoberta-pk">
    <div className="mb-10"><h2 className="mb-4 text-2xl font-bold">Encontre o caminho para a sua vedação</h2><JornadaPk compacta /></div>
    <h2 id="descoberta-pk" className="text-2xl font-bold">Vedar, retirar sujeira e apoiar o movimento</h2>
    <p className="mt-3 max-w-3xl text-muted-foreground">A seleção por função ajuda a formar o conjunto do cilindro. Perfil, dimensões e condições de trabalho precisam ser confirmados para cada referência.</p>
    <div className="mt-6 grid gap-4 md:grid-cols-3">
      <div className="rounded-xl border border-border p-5"><h3 className="font-semibold">Conter o fluido</h3><p className="mt-2 text-sm">Gaxetas PU para a posição de haste ou êmbolo especificada.</p><Link href="/guias/perfis-b-bs-std" className="mt-3 inline-block underline">Comparar B, BS e STD</Link></div>
      <div className="rounded-xl border border-border p-5"><h3 className="font-semibold">Retirar sujeira da haste</h3><p className="mt-2 text-sm">O raspador D participa da proteção contra resíduos no retorno.</p><Link href="/categoria/raspador-pu-tipo-d" className="mt-3 inline-block underline">Ver raspadores D</Link></div>
      <div className="rounded-xl border border-border p-5"><h3 className="font-semibold">Evitar contato metálico</h3><p className="mt-2 text-sm">O anel guia de nylon com fibra contribui para a centralização.</p><Link href="/categoria/anel-guia" className="mt-3 inline-block underline">Ver anéis guia</Link></div>
    </div>
    <h3 className="mt-8 text-xl font-semibold">Aplicações por segmento</h3>
    <SegmentosPk tenantSlug="pkvedacoes" />
    <div className="mt-7 flex flex-wrap gap-5 underline"><Link href="/guias">Guias para medir e selecionar</Link><Link href="/cotacao-lote">Organizar uma cotação por lote</Link></div>
  </section>;
}

