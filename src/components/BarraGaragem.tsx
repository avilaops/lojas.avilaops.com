import { mesclarMotos, type Moto } from "@/lib/motos";
import { motosDaLoja } from "@/lib/catalogo";
import { minhaMoto } from "@/lib/minha-moto";
import SeletorMoto from "@/components/SeletorMoto";

/**
 * Faixa logo abaixo do cabeçalho, em toda a loja de motopeças: a moto do
 * comprador (ou o seletor). É o que faz a loja "lembrar" da moto de página
 * em página, como nas grandes lojas de peças.
 */
export default async function BarraGaragem({ tenantId }: { tenantId: string }) {
  const [moto, daLoja] = await Promise.all([minhaMoto(), motosDaLoja(tenantId)]);
  return (
    <div className="barra-garagem">
      <div className="container-loja">
        <SeletorMoto opcoes={mesclarMotos(daLoja.porMarca)} moto={moto} compacto />
      </div>
    </div>
  );
}

export type { Moto };
