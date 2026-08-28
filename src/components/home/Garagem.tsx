import Link from "next/link";
import { mesclarMotos, queryDaMoto, type Moto } from "@/lib/motos";
import SeletorMoto from "@/components/SeletorMoto";

/**
 * Blocos da home de uma loja de motopeças, iguais em qualquer layout:
 * seletor grande ("qual é a sua moto?"), os modelos com mais peças na loja
 * e as marcas de peça que ela vende. Tudo vem do catálogo — a loja que
 * cadastra compatibilidade ganha esses blocos sozinha.
 */
export default function Garagem({ moto, motos, marcas, nomeDaLoja }: { moto: Moto | null; motos: { porMarca: Record<string, string[]>; populares: Array<{ marca: string; modelo: string; pecas: number }> }; marcas: string[]; nomeDaLoja: string }) {
  const populares = motos.populares.slice(0, 12);
  return (
    <div className="home-garagem">
      <section className="container-loja">
        <div className="garagem-hero">
          <div>
            <p className="home-selo text-primary">Peças certas, sem erro</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Qual é a sua moto?</h2>
            <p className="mt-2 max-w-md text-sm text-muted-foreground">Escolha marca, modelo e ano. A {nomeDaLoja} mostra só o que serve na sua moto, e lembra dela nas próximas visitas.</p>
          </div>
          <SeletorMoto opcoes={mesclarMotos(motos.porMarca)} moto={moto} />
        </div>
      </section>

      {populares.length > 0 && (
        <section className="container-loja mt-10">
          <div className="mb-4 flex items-end justify-between">
            <div>
              <p className="home-selo text-primary">Compre por moto</p>
              <h2 className="mt-1 text-xl font-bold tracking-tight">Modelos mais atendidos</h2>
            </div>
          </div>
          <ul className="garagem-modelos">
            {populares.map((m) => (
              <li key={`${m.marca}|${m.modelo}`}>
                <Link href={`/produtos?${queryDaMoto({ marca: m.marca, modelo: m.modelo })}`}>
                  <small>{m.marca}</small>
                  <strong>{m.modelo}</strong>
                  <span>{m.pecas} {m.pecas === 1 ? "peça" : "peças"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {marcas.length > 0 && (
        <section className="container-loja mt-10">
          <p className="home-selo text-primary">Marcas</p>
          <h2 className="mb-4 mt-1 text-xl font-bold tracking-tight">Fabricantes que vendemos</h2>
          <ul className="garagem-marcas">
            {marcas.map((m) => (
              <li key={m}><Link href={`/produtos?q=${encodeURIComponent(m)}`}>{m}</Link></li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
