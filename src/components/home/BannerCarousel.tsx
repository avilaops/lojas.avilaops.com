"use client";

import Link from "@/components/LinkLoja";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Campanha = { imagemUrl: string; imagemMobileUrl?: string; link: string; alt: string };

export default function BannerCarousel({ campanhas }: { campanhas: Campanha[] }) {
  const trilho = useRef<HTMLDivElement>(null);
  const [ativa, setAtiva] = useState(0);
  const [pausado, setPausado] = useState(false);
  // Carrossel horizontal conta como "perto da tela" para o lazy-loading do
  // navegador. Sem este controle, as três artes da VedaShow eram baixadas em
  // paralelo e a primeira, que é o LCP, esperava as outras duas na rede móvel.
  const [carregadas, setCarregadas] = useState<Set<number>>(() => new Set([0]));

  function carregar(indice: number) {
    setCarregadas((atuais) => atuais.has(indice) ? atuais : new Set([...atuais, indice]));
  }

  useEffect(() => {
    if (campanhas.length < 2 || pausado || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const destino = ativa >= campanhas.length - 1 ? 0 : ativa + 1;
    const preCarregamento = window.setTimeout(() => carregar(destino), 3500);
    const temporizador = window.setTimeout(() => {
      const elemento = trilho.current;
      if (!elemento) return;
      elemento.scrollTo({ left: elemento.clientWidth * destino });
    }, 6000);
    return () => {
      window.clearTimeout(preCarregamento);
      window.clearTimeout(temporizador);
    };
  }, [ativa, campanhas.length, pausado]);

  if (!campanhas.length) return null;

  function navegar(direcao: -1 | 1) {
    const elemento = trilho.current;
    if (!elemento) return;
    const destino = Math.max(0, Math.min(campanhas.length - 1, ativa + direcao));
    carregar(destino);
    elemento.scrollTo({ left: elemento.clientWidth * destino });
  }

  return (
    <section
      className="banner-campanhas"
      aria-label="Campanhas da loja"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocusCapture={() => setPausado(true)}
      onBlurCapture={(evento) => {
        if (!evento.currentTarget.contains(evento.relatedTarget as Node | null)) setPausado(false);
      }}
      onTouchStart={() => setPausado(true)}
      onTouchEnd={() => setPausado(false)}
    >
      <div
        className="banner-campanhas-trilho"
        ref={trilho}
        onScroll={(evento) => {
          const elemento = evento.currentTarget;
          const indice = Math.max(0, Math.min(campanhas.length - 1, Math.round(elemento.scrollLeft / elemento.clientWidth)));
          carregar(indice);
          setAtiva(indice);
        }}
      >
        {campanhas.map((campanha, indice) => {
          return (
          <Link className="banner-campanha" key={`${campanha.imagemUrl}-${indice}`} href={campanha.link}>
            <picture>
              {campanha.imagemMobileUrl && carregadas.has(indice) && <source media="(max-width: 640px)" srcSet={campanha.imagemMobileUrl} />}
              <img
                src={carregadas.has(indice) ? campanha.imagemUrl : undefined}
                alt={campanha.alt}
                width={1600}
                height={900}
                fetchPriority={indice === 0 ? "high" : "auto"}
                loading={indice === 0 ? "eager" : "lazy"}
                data-carregada={carregadas.has(indice) ? "true" : "false"}
              />
            </picture>
          </Link>
          );
        })}
      </div>
      {campanhas.length > 1 && <>
        <button className="banner-campanhas-seta anterior" type="button" aria-label="Campanha anterior" onClick={() => navegar(-1)} disabled={ativa === 0}>
          <ChevronLeft aria-hidden="true" />
        </button>
        <button className="banner-campanhas-seta proxima" type="button" aria-label="Próxima campanha" onClick={() => navegar(1)} disabled={ativa === campanhas.length - 1}>
          <ChevronRight aria-hidden="true" />
        </button>
        <div className="banner-campanhas-pontos" aria-label={`Campanha ${ativa + 1} de ${campanhas.length}`}>
          {campanhas.map((campanha, indice) => (
            <button
              key={`${campanha.imagemUrl}-ponto-${indice}`}
              type="button"
              aria-label={`Mostrar campanha ${indice + 1}`}
              aria-current={ativa === indice ? "true" : undefined}
              onClick={() => {
                carregar(indice);
                trilho.current?.scrollTo({ left: (trilho.current?.clientWidth ?? 0) * indice });
              }}
            />
          ))}
        </div>
      </>}
    </section>
  );
}
