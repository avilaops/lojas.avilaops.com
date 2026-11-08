import Image from "next/image";
import Link from "@/components/LinkLoja";
import { textos } from "@/content/vitrine/guia-automotivo.mdx";
import FaixaMarcas from "./FaixaMarcas";

/** Arquivos locais conferidos; marcas não cadastradas conservam o nome. */
const logos: Record<string, { arquivo: string; inverter?: boolean }> = {
  KRMAI: { arquivo: "krmai.svg", inverter: true },
  RAW: { arquivo: "raw.svg" },
  BRW: { arquivo: "brw.svg" },
  ZUNKY: { arquivo: "zunky.svg" },
  ZEUS: { arquivo: "zeus.svg" },
  VOLCANO: { arquivo: "volcano.svg" },
  PIRELLI: { arquivo: "pirelli.svg" },
  PRESENZA: { arquivo: "presenza.svg" },
  YOKOHAMA: { arquivo: "yokohama.svg" },
  DELINTE: { arquivo: "delinte.svg" },
  SCORRO: { arquivo: "scorro.svg" },
};

export default function Marcas({ marcas }: { marcas: string[] }) {
  if (!marcas.length) return null;
  return <section className="ap-marcas-continuas" aria-labelledby="ap-marcas-titulo">
    <h2 id="ap-marcas-titulo" className="sr-only">{textos.marcasTitulo}</h2>
    <FaixaMarcas>
      {[false, true].map(copia => <div key={String(copia)} className="ap-marcas-grupo" aria-hidden={copia || undefined}>
      {marcas.map(marca => {
        const logo = logos[marca.trim().toLocaleUpperCase("pt-BR")];
        const arte = logo ? <Image src={`/marcas/automotivo/${logo.arquivo}`} width={140} height={60} alt="" unoptimized loading="lazy" className={logo.inverter ? "ap-marca-invertida" : undefined} /> : <strong>{marca}</strong>;
        return <Link key={marca} href={`/produtos?fabricante=${encodeURIComponent(marca)}`} className="ap-marca-item" aria-label={`Ver produtos ${marca}`} tabIndex={copia ? -1 : undefined}>{arte}</Link>;
      })}
      </div>)}
    </FaixaMarcas>
  </section>;
}
